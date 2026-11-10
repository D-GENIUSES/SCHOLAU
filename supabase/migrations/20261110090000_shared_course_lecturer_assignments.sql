-- Shared-course teaching assignments: expand lecturer picks to all programme
-- siblings (same course_id + semester_id), enrich admin offering payloads with
-- faculty, dedupe the lecturer course list, and fan out class announcements.

begin;

create or replace function private.expand_shared_offering_ids(p_offering_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct id order by id), '{}'::uuid[])
  from (
    select unnest(coalesce(p_offering_ids, '{}'::uuid[])) as id
    union
    select sibling
    from unnest(coalesce(p_offering_ids, '{}'::uuid[])) as selected(id)
    cross join lateral private.shared_course_offerings(selected.id) as sibling
  ) expanded;
$$;

revoke all on function private.expand_shared_offering_ids(uuid[]) from public, anon, authenticated;

create or replace function private.lecturer_offering_json(
  p_offering_id uuid,
  p_code text,
  p_title text,
  p_university text,
  p_faculty_id uuid,
  p_faculty text,
  p_department_id uuid,
  p_department text,
  p_course_id uuid,
  p_semester text,
  p_period text,
  p_shared_departments jsonb default '[]'::jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_offering_id,
    'code', p_code,
    'title', p_title,
    'university', p_university,
    'faculty_id', p_faculty_id,
    'faculty', p_faculty,
    'department_id', p_department_id,
    'department', p_department,
    'course_id', p_course_id,
    'semester', p_semester,
    'period', p_period,
    'shared_departments', coalesce(p_shared_departments, '[]'::jsonb)
  );
$$;

revoke all on function private.lecturer_offering_json(uuid, text, text, text, uuid, text, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;

create or replace function private.finalize_admin_created_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := new.raw_app_meta_data->'scholau_provision';
  actor uuid;
  account_role text;
  req uuid;
  pending private.admin_created_accounts%rowtype;
  offerings uuid[];
  available integer;
begin
  if m is null or new.email_confirmed_at is null then return new; end if;
  select * into pending from private.admin_created_accounts where user_id = new.id for update;
  if found and pending.finalized then return new; end if;
  if pending.user_id is null or pending.creation_transaction is distinct from txid_current() then
    perform private.raise_error('FORBIDDEN', 'Managed accounts must be provisioned during creation.');
  end if;
  actor := (m->>'actor_id')::uuid;
  account_role := m->>'role';
  req := (m->>'request_key')::uuid;
  if actor is null or not private.user_is_admin(actor) then
    perform private.raise_error('FORBIDDEN', 'Active administrator required.');
  end if;
  if account_role is null or account_role not in ('student', 'lecturer') or account_role <> pending.role or req is null then
    perform private.raise_error('VALIDATION_FAILED', 'Invalid managed account details.');
  end if;

  if m ? 'offering_ids' then
    if account_role <> 'lecturer' or jsonb_typeof(m->'offering_ids') is distinct from 'array' then
      perform private.raise_error('VALIDATION_FAILED', 'Invalid teaching assignments.');
    end if;
    if jsonb_array_length(m->'offering_ids') not between 1 and 500 then
      perform private.raise_error('VALIDATION_FAILED', 'Select at least one published course.');
    end if;
    select array_agg(distinct id::uuid order by id::uuid) into offerings
    from jsonb_array_elements_text(m->'offering_ids') as selected(id);
    perform 1 from public.course_offerings o
    where o.id = any(offerings) and o.status = 'published'
    order by o.id for share;
    get diagnostics available = row_count;
    if available <> cardinality(offerings) then
      perform private.raise_error('VALIDATION_FAILED', 'Choose published course offerings.');
    end if;
    offerings := private.expand_shared_offering_ids(offerings);
  end if;

  update private.admin_created_accounts set created_by = actor, request_key = req, finalized = true
  where user_id = new.id;
  insert into public.user_roles(user_id, role) values (new.id, account_role);
  if offerings is not null then
    insert into public.lecturer_course_assignments(user_id, offering_id, assigned_by)
    select new.id, id, actor from unnest(offerings) as selected(id);
    perform private.audit(actor, 'set_user_courses', 'profile', new.id, req, null,
      jsonb_build_object('offering_ids', to_jsonb(offerings)));
  end if;
  perform private.audit(actor, 'create_user', 'profile', new.id, req, null, jsonb_build_object('role', account_role));
  return new;
end $$;

create or replace function public.admin_set_user_courses_v1(
  p_user_id uuid, p_offering_ids uuid[], p_expected_offering_ids uuid[], p_request_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_admin();
  current_ids uuid[];
  wanted uuid[];
  expected uuid[];
  app public.lecturer_applications;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  perform 1 from public.profiles where id = p_user_id and deactivated_at is null for update;
  if not found then perform private.raise_error('INVALID_STATE', 'An active lecturer account is required.'); end if;
  select * into app from public.lecturer_applications where user_id = p_user_id for update;
  if exists (
    select 1 from private.audit_log
    where actor_id = actor and action = 'set_user_courses' and request_key = p_request_key
      and entity_id is distinct from p_user_id
  ) then
    perform private.raise_error('VALIDATION_FAILED', 'Request key already belongs to another account.');
  end if;
  if exists (
    select 1 from private.audit_log
    where actor_id = actor and action = 'set_user_courses' and request_key = p_request_key and entity_id = p_user_id
  ) then
    return private.envelope(jsonb_build_object('user', private.admin_user_payload(p_user_id)), p_request_key);
  end if;
  if not exists (select 1 from public.user_roles where user_id = p_user_id and role = 'lecturer')
     or not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then
    perform private.raise_error('FORBIDDEN', 'Approved lecturer access is required.');
  end if;
  if p_offering_ids is null or p_expected_offering_ids is null
     or cardinality(p_offering_ids) > 500
     or array_position(p_offering_ids, null) is not null then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  select coalesce(array_agg(offering_id order by offering_id), '{}') into current_ids
  from public.lecturer_course_assignments where user_id = p_user_id;
  select coalesce(array_agg(distinct x order by x), '{}') into expected from unnest(p_expected_offering_ids) x;
  if expected is distinct from current_ids then perform private.raise_error('STALE_REVISION'); end if;
  select coalesce(array_agg(distinct x order by x), '{}') into wanted from unnest(p_offering_ids) x;
  if exists (
    select 1 from unnest(wanted) x
    where not exists (
      select 1 from public.course_offerings where id = x and (status = 'published' or x = any(current_ids))
    )
  ) then
    perform private.raise_error('VALIDATION_FAILED', 'Choose published course offerings.');
  end if;
  wanted := private.expand_shared_offering_ids(wanted);
  delete from public.lecturer_course_assignments where user_id = p_user_id and not (offering_id = any(wanted));
  insert into public.lecturer_course_assignments(user_id, offering_id, assigned_by)
  select p_user_id, x, actor from unnest(wanted) x on conflict do nothing;
  if app.id is not null then
    update public.lecturer_applications set revision = revision + 1, updated_at = now() where id = app.id;
    insert into private.lecturer_application_reviews(application_id, actor_id, action, request_key)
    values (app.id, actor, 'courses_assigned', p_request_key);
  end if;
  perform private.audit(actor, 'set_user_courses', 'profile', p_user_id, p_request_key, null,
    jsonb_build_object('offering_ids', to_jsonb(wanted)));
  return private.envelope(jsonb_build_object('user', private.admin_user_payload(p_user_id)), p_request_key);
end $$;

create or replace function public.admin_assign_lecturer_courses_v1(
  p_application_id uuid, p_offering_ids uuid[], p_revision integer, p_request_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_admin();
  a public.lecturer_applications;
  wanted uuid[];
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select * into a from public.lecturer_applications where id = p_application_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if exists (
    select 1 from private.lecturer_application_reviews
    where application_id = a.id and actor_id = v_uid and request_key = p_request_key and action = 'courses_assigned'
  ) then
    return private.envelope(jsonb_build_object('application', private.lecturer_application_payload(a.id, true)), p_request_key);
  end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if a.status <> 'approved'
     or not exists (select 1 from public.user_roles where user_id = a.user_id and role = 'lecturer') then
    perform private.raise_error('INVALID_STATE', 'Approve the lecturer before assigning courses.');
  end if;
  if coalesce(cardinality(p_offering_ids), 0) > 500
     or exists (
       select 1 from unnest(p_offering_ids) x(id)
       where not exists (select 1 from public.course_offerings o where o.id = x.id and o.status = 'published')
     ) then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  wanted := private.expand_shared_offering_ids(coalesce(p_offering_ids, '{}'::uuid[]));
  delete from public.lecturer_course_assignments where user_id = a.user_id;
  insert into public.lecturer_course_assignments(user_id, offering_id, assigned_by)
  select a.user_id, x, v_uid from unnest(wanted) x on conflict do nothing;
  update public.lecturer_applications set revision = revision + 1, updated_at = now() where id = a.id;
  insert into private.lecturer_application_reviews(application_id, actor_id, action, request_key)
  values (a.id, v_uid, 'courses_assigned', p_request_key);
  perform private.audit(v_uid, 'assign_lecturer_courses', 'lecturer_application', a.id, p_request_key);
  return private.envelope(jsonb_build_object('application', private.lecturer_application_payload(a.id, true)), p_request_key);
end $$;

create or replace function public.admin_review_lecturer_application_v1(
  p_application_id uuid, p_decision text, p_applicant_message text, p_internal_note text,
  p_offering_ids uuid[], p_revision integer, p_request_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_admin();
  a public.lecturer_applications;
  v_existing private.lecturer_application_reviews;
begin
  perform private.assert_client_supported();
  perform private.require_request_key(p_request_key);
  select * into a from public.lecturer_applications where id = p_application_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  select * into v_existing from private.lecturer_application_reviews
  where actor_id = v_uid and request_key = p_request_key;
  if found then
    if v_existing.application_id <> a.id or v_existing.action <> p_decision then
      perform private.raise_error('INVALID_STATE', 'This request key was already used.');
    end if;
    return private.envelope(jsonb_build_object('application', private.lecturer_application_payload(a.id, true)), p_request_key);
  end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  if a.status <> 'pending' then perform private.raise_error('INVALID_STATE', 'Only pending applications can be reviewed.'); end if;
  if p_decision is null or p_decision not in ('approved', 'changes_requested', 'rejected') then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if length(coalesce(p_applicant_message, '')) > 2000
     or length(coalesce(p_internal_note, '')) > 2000
     or (p_decision <> 'approved' and length(btrim(coalesce(p_applicant_message, ''))) < 8) then
    perform private.raise_error('VALIDATION_FAILED', 'Give the applicant clear feedback (8–2000 characters).');
  end if;
  if p_decision = 'approved'
     and not exists (select 1 from auth.users where id = a.user_id and email_confirmed_at is not null) then
    perform private.raise_error('FORBIDDEN', 'The applicant must confirm their email before approval.');
  end if;
  if p_decision = 'approved' then
    select coalesce(array_agg(distinct x.id order by x.id), '{}'::uuid[]) into p_offering_ids
    from (
      select value::uuid as id
      from jsonb_array_elements_text(private.lecturer_requested_assignment_plan(a.id)->'offering_ids')
      union all
      select id from unnest(coalesce(p_offering_ids, '{}'::uuid[])) as extra(id)
    ) x;
    p_offering_ids := private.expand_shared_offering_ids(p_offering_ids);
  end if;
  if coalesce(cardinality(p_offering_ids), 0) > 500
     or exists (
       select 1 from unnest(p_offering_ids) x(id)
       where not exists (select 1 from public.course_offerings o where o.id = x.id and o.status = 'published')
     ) then
    perform private.raise_error('VALIDATION_FAILED', 'Select valid published course offerings.');
  end if;
  update public.lecturer_applications
  set status = p_decision,
      applicant_message = btrim(coalesce(p_applicant_message, '')),
      reviewed_by = v_uid,
      reviewed_at = now(),
      revision = revision + 1,
      updated_at = now()
  where id = a.id;
  if p_decision = 'approved' then
    insert into public.user_roles(user_id, role, granted_by) values (a.user_id, 'lecturer', v_uid)
    on conflict do nothing;
    insert into public.lecturer_course_assignments(user_id, offering_id, assigned_by)
    select a.user_id, x, v_uid from unnest(coalesce(p_offering_ids, '{}'::uuid[])) x
    on conflict do nothing;
  end if;
  insert into private.lecturer_application_reviews(
    application_id, actor_id, action, applicant_message, internal_note, request_key
  ) values (
    a.id, v_uid, p_decision, btrim(coalesce(p_applicant_message, '')),
    btrim(coalesce(p_internal_note, '')), p_request_key
  );
  insert into public.notifications(user_id, kind, body, safe_target, event_key)
  values (
    a.user_id, 'lecturer_application',
    case p_decision
      when 'approved' then 'Your lecturer application has been approved.'
      when 'changes_requested' then 'Your lecturer application needs changes. Sign in to read the feedback.'
      else 'Your lecturer application has been reviewed. Sign in to read the decision.'
    end,
    '/lecturer/application',
    'lecturer_application:' || a.id || ':' || (a.revision + 1)
  );
  perform private.audit(v_uid, 'review_lecturer_application', 'lecturer_application', a.id, p_request_key, null,
    jsonb_build_object('decision', p_decision));
  return private.envelope(jsonb_build_object('application', private.lecturer_application_payload(a.id, true)), p_request_key);
end $$;

create or replace function public.admin_get_lecturer_offerings_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_admin();
begin
  return private.envelope(jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        private.lecturer_offering_json(
          o.id, c.code, c.title, u.name, f.id, f.name, d.id, d.name, c.id, s.label, ap.label,
          coalesce((
            select jsonb_agg(sd.name order by sd.name)
            from private.shared_course_offerings(o.id) sibling
            join public.course_offerings so on so.id = sibling
            join public.departments sd on sd.id = so.department_id
            where sd.id is distinct from d.id
          ), '[]'::jsonb)
        )
        order by u.name, f.name, c.code, d.name, o.id
      )
      from public.course_offerings o
      join public.courses c on c.id = o.course_id
      join public.universities u on u.id = o.university_id
      join public.departments d on d.id = o.department_id
      join public.faculties f on f.id = d.faculty_id
      join public.semesters s on s.id = o.semester_id
      join public.academic_periods ap on ap.id = s.academic_period_id
      where o.status = 'published'
    ), '[]'::jsonb)
  ));
end $$;

create or replace function public.get_my_lecturer_courses_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
begin
  if not exists (
    select 1 from private.admin_created_accounts m
    join public.user_roles r on r.user_id = m.user_id and r.role = 'lecturer'
    join auth.users u on u.id = m.user_id
    where m.user_id = v_uid and m.role = 'lecturer' and m.finalized and u.email_confirmed_at is not null
  ) and not exists (
    select 1 from public.user_roles r
    join public.lecturer_applications a on a.user_id = r.user_id
    join auth.users u on u.id = r.user_id
    where r.user_id = v_uid and r.role = 'lecturer' and a.status = 'approved' and u.email_confirmed_at is not null
  ) then
    perform private.raise_error('FORBIDDEN', 'Approved lecturer access required.');
  end if;

  return private.envelope(jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        private.lecturer_offering_json(
          host.id, host.code, host.title, host.university, host.faculty_id, host.faculty,
          host.department_id, host.department, host.course_id, host.semester, host.period,
          host.shared_departments
        )
        order by host.code, host.id
      )
      from (
        select distinct on (o.course_id, o.semester_id)
          o.id,
          c.code,
          c.title,
          u.name as university,
          f.id as faculty_id,
          f.name as faculty,
          d.id as department_id,
          d.name as department,
          c.id as course_id,
          s.label as semester,
          ap.label as period,
          coalesce((
            select jsonb_agg(sd.name order by sd.name)
            from private.shared_course_offerings(o.id) sibling
            join public.course_offerings so on so.id = sibling
            join public.departments sd on sd.id = so.department_id
            where sd.id is distinct from d.id
          ), '[]'::jsonb) as shared_departments
        from public.lecturer_course_assignments x
        join public.course_offerings o on o.id = x.offering_id
        join public.courses c on c.id = o.course_id
        join public.universities u on u.id = o.university_id
        join public.departments d on d.id = o.department_id
        join public.faculties f on f.id = d.faculty_id
        join public.semesters s on s.id = o.semester_id
        join public.academic_periods ap on ap.id = s.academic_period_id
        where x.user_id = v_uid and o.status = 'published'
        order by
          o.course_id,
          o.semester_id,
          case when d.name = 'Computer Science' then 0 else 1 end,
          d.name,
          o.id
      ) host
    ), '[]'::jsonb)
  ));
end $$;

create or replace function private.class_announcement_students(p_offering uuid)
returns setof uuid language sql stable set search_path = '' as $$
  select distinct e.user_id
  from private.shared_course_offerings(p_offering) sibling
  join public.enrollments e on e.offering_id = sibling
  join public.profiles p on p.id = e.user_id
  join public.user_roles r on r.user_id = e.user_id and r.role = 'student'
  where e.ended_at is null and p.deactivated_at is null
    and not exists (select 1 from private.pending_registrations pr where pr.user_id = e.user_id);
$$;

create or replace function private.announcement_recipients(p_actor uuid, p_audience text, p_id text)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  admin boolean := exists (select 1 from public.user_roles where user_id = p_actor and role = 'admin');
  offering uuid;
begin
  if p_audience is null or p_audience not in ('offering', 'role', 'everyone') then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if not admin and (p_audience <> 'offering' or not private.can_announce_as_lecturer(p_actor)) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if p_audience = 'offering' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform private.raise_error('VALIDATION_FAILED');
    end if;
    offering := p_id::uuid;
    if not exists (select 1 from public.course_offerings where id = offering and status = 'published') then
      perform private.raise_error('VALIDATION_FAILED');
    end if;
    if admin then
      return query
      select distinct e.user_id
      from private.shared_course_offerings(offering) sibling
      join public.enrollments e on e.offering_id = sibling
      join public.profiles p on p.id = e.user_id
      where e.ended_at is null and p.deactivated_at is null;
    else
      if not private.can_announce_to_class(p_actor, offering) then perform private.raise_error('FORBIDDEN'); end if;
      return query select * from private.class_announcement_students(offering);
    end if;
  elsif p_audience = 'role' then
    if p_id is null or p_id not in ('student', 'lecturer', 'admin') then
      perform private.raise_error('VALIDATION_FAILED');
    end if;
    return query
    select r.user_id from public.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.role = p_id and p.deactivated_at is null;
  else
    return query select id from public.profiles where deactivated_at is null;
  end if;
end;
$$;

create or replace function public.get_announcement_audiences_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  admin boolean := exists (select 1 from public.user_roles where user_id = actor and role = 'admin');
begin
  if not admin and not private.can_announce_as_lecturer(actor) then
    perform private.raise_error('FORBIDDEN');
  end if;
  return private.envelope(jsonb_build_object('offerings', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', host.id,
      'label', host.code || ' — ' || host.title || ' · ' || host.department || ' · ' || host.semester || ' · ' || host.period
    ) order by host.code, host.id)
    from (
      select distinct on (o.course_id, o.semester_id)
        o.id,
        c.code,
        c.title,
        d.name as department,
        s.label as semester,
        ap.label as period
      from public.course_offerings o
      join public.courses c on c.id = o.course_id
      join public.departments d on d.id = o.department_id
      join public.semesters s on s.id = o.semester_id
      join public.academic_periods ap on ap.id = s.academic_period_id
      where o.status = 'published'
        and (
          admin
          or exists (
            select 1 from public.lecturer_course_assignments a
            where a.user_id = actor and a.offering_id = o.id
          )
        )
      order by
        o.course_id,
        o.semester_id,
        case when d.name = 'Computer Science' then 0 else 1 end,
        d.name,
        o.id
    ) host
  ), '[]'::jsonb)));
end;
$$;

commit;
