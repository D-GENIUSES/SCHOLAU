-- Mass Communication is listed under Faculty of Business and Social Sciences for signup.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
select set_config('t.uni',(select id::text from public.universities where slug='adeleke-university-ede-osun-state'),true) is not null as setup;
select set_config('t.faculty',(select f.id::text from public.faculties f where f.university_id=current_setting('t.uni')::uuid and f.name='Faculty of Business and Social Sciences'),true) is not null as setup;
select ok(
  exists(
    select 1 from public.departments d
    where d.faculty_id=current_setting('t.faculty')::uuid and d.name='Mass Communication' and d.active
  ),
  'Mass Communication department is active under Business and Social Sciences'
);
select ok(
  exists(
    select 1
    from jsonb_array_elements(public.get_registration_options_v1('adeleke-university-ede-osun-state')->'departments') elem
    where elem->>'name'='Mass Communication'
      and elem->>'faculty_id'=current_setting('t.faculty')
  ),
  'Mass Communication appears in pre-signup registration options'
);
select is(
  (select count(*)::integer from public.curriculum_courses cc join public.departments d on d.id=cc.department_id where d.name='Mass Communication'),
  0,
  'Mass Communication has no curriculum until a verified list is seeded'
);
select * from finish();
rollback;
