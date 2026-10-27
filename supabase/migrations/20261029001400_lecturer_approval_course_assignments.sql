-- Recompute requested assignments on the server at approval time. No roles or
-- assignments are changed by viewing a plan, and existing approved users are untouched.
create or replace function private.lecturer_academic_key(p_value text)
returns text language sql immutable set search_path='' as $$
  select regexp_replace(regexp_replace(lower(btrim(p_value)), '^(faculty|department)[[:space:]]+of[[:space:]]+', ''), '[^a-z0-9]', '', 'g');
$$;

create or replace function private.lecturer_requested_assignment_plan(p_application_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  with application as (
    select a.* from public.lecturer_applications a where a.id=p_application_id
  ), candidates as (
    select d.id,d.university_id from application a
    join public.universities u on u.active and (
      private.lecturer_academic_key(u.name)=private.lecturer_academic_key(a.university)
      or private.lecturer_academic_key(split_part(u.name,',',1))=private.lecturer_academic_key(a.university))
    join public.faculties f on f.university_id=u.id and f.active
      and private.lecturer_academic_key(f.name)=private.lecturer_academic_key(a.faculty)
    join public.departments d on d.university_id=u.id and d.faculty_id=f.id and d.active
      and private.lecturer_academic_key(d.name)=private.lecturer_academic_key(a.department)
  ), department as (
    -- Never guess between institutions or departments with matching names.
    select * from candidates where (select count(*) from candidates)=1
  ), requests as (
    select distinct btrim(r.line) as request from application a
    cross join lateral regexp_split_to_table(a.requested_courses,E'\r?\n') r(line)
    where btrim(r.line)<>''
  ), eligible as (
    select o.id,o.course_id from department d
    join public.course_offerings o on o.university_id=d.university_id and o.department_id=d.id and o.status='published'
    join public.levels l on l.id=o.level_id and l.active
    join public.semesters s on s.id=o.semester_id and s.active
    join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
  ), course_matches as (
    select distinct r.request,c.id as course_id from requests r
    join public.courses c on c.active and
      lower(regexp_replace(btrim(split_part(split_part(r.request,' — ',1),' - ',1)),'[[:space:]]','','g'))
      =lower(regexp_replace(c.code,'[[:space:]]','','g'))
    join eligible e on e.course_id=c.id
  ), unambiguous as (
    select request from course_matches group by request having count(distinct course_id)=1
  ), matched as (
    select cm.request,e.id from course_matches cm join unambiguous u using(request) join eligible e on e.course_id=cm.course_id
  )
  select jsonb_build_object(
    'offering_ids',coalesce((select jsonb_agg(x.id order by x.id) from (select distinct id from matched) x),'[]'::jsonb),
    'unmatched_requests',coalesce((select jsonb_agg(r.request order by r.request) from requests r where not exists(select 1 from matched m where m.request=r.request)),'[]'::jsonb)
  );
$$;
revoke all on function private.lecturer_academic_key(text),private.lecturer_requested_assignment_plan(uuid) from public,anon,authenticated;

create or replace function public.admin_get_lecturer_application_v1(p_application_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin(); a jsonb;
begin
  a:=private.lecturer_application_payload(p_application_id,true);
  if a is null then perform private.raise_error('NOT_FOUND'); end if;
  if a->>'status'='pending' then
    a:=a||jsonb_build_object('course_assignment_plan',private.lecturer_requested_assignment_plan(p_application_id));
  end if;
  return private.envelope(jsonb_build_object('application',a));
end $$;

create or replace function public.admin_review_lecturer_application_v1(p_application_id uuid,p_decision text,p_applicant_message text,p_internal_note text,p_offering_ids uuid[],p_revision integer,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=private.require_admin(); a public.lecturer_applications; v_existing private.lecturer_application_reviews;
begin
  perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
  select * into a from public.lecturer_applications where id=p_application_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_existing from private.lecturer_application_reviews where actor_id=v_uid and request_key=p_request_key;
  if found then
    if v_existing.application_id<>a.id or v_existing.action<>p_decision then perform private.raise_error('INVALID_STATE','This request key was already used.'); end if;
    return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,true)),p_request_key);
  end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if a.status<>'pending' then perform private.raise_error('INVALID_STATE','Only pending applications can be reviewed.'); end if;
  if p_decision is null or p_decision not in('approved','changes_requested','rejected') then perform private.raise_error('VALIDATION_FAILED'); end if;
  if length(coalesce(p_applicant_message,''))>2000 or length(coalesce(p_internal_note,''))>2000 or (p_decision<>'approved' and length(btrim(coalesce(p_applicant_message,'')))<8) then perform private.raise_error('VALIDATION_FAILED','Give the applicant clear feedback (8–2000 characters).'); end if;
  if p_decision='approved' and not exists(select 1 from auth.users where id=a.user_id and email_confirmed_at is not null) then perform private.raise_error('FORBIDDEN','The applicant must confirm their email before approval.'); end if;
  if p_decision='approved' then
    -- Caller-supplied offerings add to, never replace, the lecturer's matched requests.
    select coalesce(array_agg(distinct x.id order by x.id),'{}'::uuid[]) into p_offering_ids
    from (
      select value::uuid as id from jsonb_array_elements_text(private.lecturer_requested_assignment_plan(a.id)->'offering_ids')
      union all select id from unnest(coalesce(p_offering_ids,'{}'::uuid[])) as extra(id)
    ) x;
  end if;
  if coalesce(cardinality(p_offering_ids),0)>100 or exists(select 1 from unnest(p_offering_ids) x(id) where not exists(select 1 from public.course_offerings o where o.id=x.id and o.status='published')) then perform private.raise_error('VALIDATION_FAILED','Select valid published course offerings.'); end if;
  update public.lecturer_applications set status=p_decision,applicant_message=btrim(coalesce(p_applicant_message,'')),reviewed_by=v_uid,reviewed_at=now(),revision=revision+1,updated_at=now() where id=a.id;
  if p_decision='approved' then
    insert into public.user_roles(user_id,role,granted_by) values(a.user_id,'lecturer',v_uid) on conflict do nothing;
    insert into public.lecturer_course_assignments(user_id,offering_id,assigned_by) select a.user_id,x,v_uid from unnest(coalesce(p_offering_ids,'{}'::uuid[])) x on conflict do nothing;
  end if;
  insert into private.lecturer_application_reviews(application_id,actor_id,action,applicant_message,internal_note,request_key) values(a.id,v_uid,p_decision,btrim(coalesce(p_applicant_message,'')),btrim(coalesce(p_internal_note,'')),p_request_key);
  insert into public.notifications(user_id,kind,body,safe_target,event_key) values(a.user_id,'lecturer_application',case p_decision when 'approved' then 'Your lecturer application has been approved.' when 'changes_requested' then 'Your lecturer application needs changes. Sign in to read the feedback.' else 'Your lecturer application has been reviewed. Sign in to read the decision.' end,'/lecturer/application','lecturer_application:'||a.id||':'||(a.revision+1));
  perform private.audit(v_uid,'review_lecturer_application','lecturer_application',a.id,p_request_key,null,jsonb_build_object('decision',p_decision));
  return private.envelope(jsonb_build_object('application',private.lecturer_application_payload(a.id,true)),p_request_key);
end $$;
