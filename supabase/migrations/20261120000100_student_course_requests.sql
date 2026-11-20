create table public.course_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  offering_id uuid not null references public.course_offerings(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, offering_id)
);
create index course_requests_status on public.course_requests(status, created_at desc);
alter table public.course_requests enable row level security;
revoke all on public.course_requests from public, anon, authenticated;

create or replace function public.get_student_course_request_options_v1(p_search text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_profile public.profiles;
begin
 select * into v_profile from public.profiles where id=v_uid;
 return private.envelope(jsonb_build_object('courses', coalesce((select jsonb_agg(jsonb_build_object(
   'offering_id',o.id,'course_id',c.id,'code',c.code,'title',c.title,
   'level',coalesce(l.label,''),'semester',coalesce(s.label,''),'period',coalesce(ap.label,'')) order by c.code,l.sort_order,ap.starts_on desc,s.sort_order)
   from public.course_offerings o join public.courses c on c.id=o.course_id
   left join public.levels l on l.id=o.level_id left join public.semesters s on s.id=o.semester_id
   left join public.academic_periods ap on ap.id=s.academic_period_id
   where o.status='published' and c.active and o.university_id=v_profile.university_id and o.department_id=v_profile.department_id
     and not exists(select 1 from public.enrollments e where e.user_id=v_uid and e.offering_id=o.id and e.ended_at is null)
     and not exists(select 1 from public.course_requests r where r.user_id=v_uid and r.offering_id=o.id and r.status='pending')
     and (p_search is null or btrim(p_search)='' or lower(c.code||' '||c.title) like '%'||lower(btrim(p_search))||'%')), '[]'::jsonb),
   'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'offering_id',r.offering_id,'status',r.status,'code',c.code,'title',c.title,'created_at',r.created_at) order by r.created_at desc)
     from public.course_requests r join public.course_offerings o on o.id=r.offering_id join public.courses c on c.id=o.course_id where r.user_id=v_uid), '[]'::jsonb)));
end; $$;

create or replace function public.create_student_course_requests_v1(p_offering_ids uuid[], p_request_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_profile public.profiles; v_id uuid; v_count integer;
begin
 perform private.require_request_key(p_request_key);
 select * into v_profile from public.profiles where id=v_uid;
 if coalesce(array_length(p_offering_ids,1),0) < 1 or array_length(p_offering_ids,1)>3 then perform private.raise_error('VALIDATION_FAILED','Choose between one and three courses.'); end if;
 select count(*) into v_count from unnest(p_offering_ids) x;
 if v_count <> array_length(p_offering_ids,1) then perform private.raise_error('VALIDATION_FAILED','Choose each course once.'); end if;
 foreach v_id in array p_offering_ids loop
   if not exists(select 1 from public.course_offerings o where o.id=v_id and o.status='published' and o.university_id=v_profile.university_id and o.department_id=v_profile.department_id and not exists(select 1 from public.enrollments e where e.user_id=v_uid and e.offering_id=o.id and e.ended_at is null)) then
     perform private.raise_error('FORBIDDEN','One or more selected courses are unavailable.');
   end if;
   insert into public.course_requests(user_id,offering_id) values(v_uid,v_id) on conflict(user_id,offering_id) do update set status='pending',reviewed_by=null,reviewed_at=null;
 end loop;
 return private.envelope(jsonb_build_object('submitted',array_length(p_offering_ids,1)),p_request_key);
end; $$;

create or replace function public.admin_list_course_requests_v1(p_status text default 'pending') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
 if not exists(select 1 from public.user_roles where user_id=v_uid and role='admin') then perform private.raise_error('FORBIDDEN','Administrator access required.'); end if;
 return private.envelope(jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'student_name',p.display_name,'offering_id',r.offering_id,'code',c.code,'title',c.title,'level',l.label,'semester',s.label,'status',r.status,'created_at',r.created_at) order by r.created_at)
   from public.course_requests r join public.profiles p on p.id=r.user_id join public.course_offerings o on o.id=r.offering_id join public.courses c on c.id=o.course_id left join public.levels l on l.id=o.level_id left join public.semesters s on s.id=o.semester_id where p_status is null or r.status=p_status), '[]'::jsonb)));
end; $$;

create or replace function public.admin_review_course_request_v1(p_request_id uuid,p_decision text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); r public.course_requests; v_enrollment public.enrollments;
begin
 perform private.require_request_key(p_request_key);
 if not exists(select 1 from public.user_roles where user_id=v_uid and role='admin') then perform private.raise_error('FORBIDDEN','Administrator access required.'); end if;
 if p_decision not in ('approved','rejected') then perform private.raise_error('VALIDATION_FAILED','Invalid decision.'); end if;
 select * into r from public.course_requests where id=p_request_id for update;
 if not found then perform private.raise_error('NOT_FOUND','Course request not found.'); end if;
 if r.status <> 'pending' then return private.envelope(jsonb_build_object('status',r.status),p_request_key); end if;
 update public.course_requests set status=p_decision,reviewed_by=v_uid,reviewed_at=now() where id=r.id;
 if p_decision='approved' then insert into public.enrollments(user_id,offering_id,request_key) values(r.user_id,r.offering_id,p_request_key) on conflict(user_id,offering_id) do update set ended_at=null; end if;
 return private.envelope(jsonb_build_object('status',p_decision),p_request_key);
end; $$;

revoke all on function public.get_student_course_request_options_v1(text),public.create_student_course_requests_v1(uuid[],uuid),public.admin_list_course_requests_v1(text),public.admin_review_course_request_v1(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.get_student_course_request_options_v1(text),public.create_student_course_requests_v1(uuid[],uuid),public.admin_list_course_requests_v1(text),public.admin_review_course_request_v1(uuid,text,uuid) to authenticated;
