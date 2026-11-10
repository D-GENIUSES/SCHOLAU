-- Shared courses expand lecturer assignments and class announcements across programmes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

create function pg_temp.new_person(kind text default 'student') returns uuid language plpgsql as $$
declare id uuid := gen_random_uuid();
begin
  insert into auth.users(id, email, created_at, email_confirmed_at, raw_user_meta_data)
  values (id, id::text || '@shared-assign.test', now(), now(), jsonb_build_object('display_name', 'Shared assign'));
  return id;
end $$;

create function pg_temp.login(id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', id, 'role', 'authenticated')::text, true);
end $$;

select set_config('t.uni', (select id::text from public.universities where slug = 'adeleke-university-ede-osun-state'), true);
select set_config('t.faculty', (select id::text from public.faculties where university_id = current_setting('t.uni')::uuid and name = 'Faculty of Science'), true);
select set_config('t.period', (select id::text from public.academic_periods where university_id = current_setting('t.uni')::uuid and label = '2026/2027'), true);
select set_config('t.semester', (select id::text from public.semesters where academic_period_id = current_setting('t.period')::uuid and sort_order = 1), true);
select set_config('t.level', (select id::text from public.levels where university_id = current_setting('t.uni')::uuid and label = '200 Level'), true);
select set_config('t.cs', (select id::text from public.departments where faculty_id = current_setting('t.faculty')::uuid and name = 'Computer Science'), true);
select set_config('t.cyber', (select id::text from public.departments where faculty_id = current_setting('t.faculty')::uuid and name = 'Cybersecurity'), true);
select set_config('t.se', (select id::text from public.departments where faculty_id = current_setting('t.faculty')::uuid and name = 'Software Engineering'), true);
select set_config('t.cs_cos', (
  select o.id::text from public.course_offerings o
  join public.courses c on c.id = o.course_id
  where o.department_id = current_setting('t.cs')::uuid and c.code = 'COS 201'
    and o.semester_id = current_setting('t.semester')::uuid and o.status = 'published'
), true);
select set_config('t.cyber_cos', (
  select o.id::text from public.course_offerings o
  join public.courses c on c.id = o.course_id
  where o.department_id = current_setting('t.cyber')::uuid and c.code = 'COS 201'
    and o.semester_id = current_setting('t.semester')::uuid and o.status = 'published'
), true);
select set_config('t.se_cos', (
  select o.id::text from public.course_offerings o
  join public.courses c on c.id = o.course_id
  where o.department_id = current_setting('t.se')::uuid and c.code = 'COS 201'
    and o.semester_id = current_setting('t.semester')::uuid and o.status = 'published'
), true);

select ok(current_setting('t.cs_cos') is not null and current_setting('t.cyber_cos') is not null and current_setting('t.se_cos') is not null, 'COS 201 offerings exist for CS Cyber and SE');

select set_config('t.admin', pg_temp.new_person()::text, true);
insert into public.user_roles(user_id, role) values (current_setting('t.admin')::uuid, 'admin');

select set_config('t.lecturer', gen_random_uuid()::text, true);
insert into auth.users(id, email, created_at, raw_user_meta_data)
values (
  current_setting('t.lecturer')::uuid,
  'shared-lecturer@shared-assign.test',
  now(),
  '{"display_name":"Shared lecturer","signup_kind":"admin_managed","managed_role":"lecturer"}'
);
update auth.users
set raw_app_meta_data = jsonb_build_object(
  'scholau_provision', jsonb_build_object(
    'actor_id', current_setting('t.admin'),
    'role', 'lecturer',
    'request_key', gen_random_uuid()
  )
)
where id = current_setting('t.lecturer')::uuid;
update auth.users set email_confirmed_at = now() where id = current_setting('t.lecturer')::uuid;
set constraints auth.admin_creation_complete immediate;
set constraints auth.admin_creation_complete deferred;

insert into private.legal_acceptances(user_id, terms_version, privacy_version, age_declaration)
select current_setting('t.lecturer')::uuid, terms_version, privacy_version, 'adult'
from private.legal_settings where singleton;

select pg_temp.login(current_setting('t.admin')::uuid);
set local role authenticated;

select lives_ok(
  format(
    'select public.admin_set_user_courses_v1(%L, array[%L]::uuid[], array[]::uuid[], gen_random_uuid())',
    current_setting('t.lecturer'),
    current_setting('t.cs_cos')
  ),
  'assigning one COS 201 offering succeeds'
);

select ok(
  (select count(*)::int from public.lecturer_course_assignments
   where user_id = current_setting('t.lecturer')::uuid
     and offering_id in (
       current_setting('t.cs_cos')::uuid,
       current_setting('t.cyber_cos')::uuid,
       current_setting('t.se_cos')::uuid
     )) >= 3,
  'assignment expands to CS Cyber and SE siblings'
);

select ok(
  (public.admin_get_lecturer_offerings_v1()->'items'->0) ? 'faculty_id'
  and (public.admin_get_lecturer_offerings_v1()->'items'->0) ? 'course_id',
  'admin offerings payload includes faculty and course ids'
);

select pg_temp.login(current_setting('t.lecturer')::uuid);
select is(
  (
    select count(*)::int
    from jsonb_array_elements(public.get_my_lecturer_courses_v1()->'items') item
    where item->>'code' = 'COS 201'
  ),
  1,
  'lecturer course list dedupes COS 201'
);
select is(
  public.get_my_lecturer_courses_v1()->'items'->0->>'department',
  'Computer Science',
  'deduped COS 201 prefers Computer Science host department'
);
select is(
  public.get_my_lecturer_courses_v1()->'items'->0->>'id',
  current_setting('t.cs_cos'),
  'deduped COS 201 uses the Computer Science offering id'
);

-- Announcement recipients include sibling-programme enrollments.
reset role;
select set_config('t.se_student', pg_temp.new_person()::text, true);
insert into public.user_roles(user_id, role) values (current_setting('t.se_student')::uuid, 'student');
select private.apply_academic_profile(
  current_setting('t.se_student')::uuid,
  current_setting('t.se_student')::uuid,
  current_setting('t.uni')::uuid,
  current_setting('t.faculty')::uuid,
  current_setting('t.se')::uuid,
  current_setting('t.level')::uuid,
  current_setting('t.period')::uuid,
  current_setting('t.semester')::uuid,
  'initial',
  null,
  null
);
insert into public.enrollments(user_id, offering_id)
values (current_setting('t.se_student')::uuid, current_setting('t.se_cos')::uuid);

select ok(
  exists (
    select 1 from private.class_announcement_students(current_setting('t.cs_cos')::uuid) student
    where student = current_setting('t.se_student')::uuid
  ),
  'class announcements from CS COS 201 reach Software Engineering enrollments'
);

select * from finish();
rollback;
