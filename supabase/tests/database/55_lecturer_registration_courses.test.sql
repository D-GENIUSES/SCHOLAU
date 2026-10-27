begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.universities(id,name,slug) values ('85000000-0000-4000-8000-000000000001','Lecturer Catalogue Test','lecturer-catalogue-test');
insert into public.faculties(id,university_id,name) values
 ('85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000001','Science'),
 ('85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000001','Engineering');
insert into public.departments(id,university_id,faculty_id,name) values
 ('85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','Computing'),
 ('85000000-0000-4000-8000-000000000005','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000003','Civil');
insert into public.levels(id,university_id,label,sort_order) values
 ('85000000-0000-4000-8000-000000000006','85000000-0000-4000-8000-000000000001','100',100),
 ('85000000-0000-4000-8000-000000000007','85000000-0000-4000-8000-000000000001','400',400);
insert into public.academic_periods(id,university_id,label,starts_on,ends_on) values
 ('85000000-0000-4000-8000-000000000008','85000000-0000-4000-8000-000000000001','2026/2027','2026-09-01','2027-08-01');
insert into public.semesters(id,university_id,academic_period_id,label,sort_order) values
 ('85000000-0000-4000-8000-000000000009','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000008','First',1),
 ('85000000-0000-4000-8000-000000000010','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000008','Second',2);
insert into public.courses(id,code,title) values
 ('85000000-0000-4000-8000-000000000011','LCT 101','First course'),
 ('85000000-0000-4000-8000-000000000012','LCT 401','Advanced course'),
 ('85000000-0000-4000-8000-000000000013','LCT 201','Other department'),
 ('85000000-0000-4000-8000-000000000014','LCT 301','Draft course');
insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference) values
 ('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000006',1,'85000000-0000-4000-8000-000000000011',3,'C',1,'Test'),
 ('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000007',2,'85000000-0000-4000-8000-000000000012',3,'C',1,'Test'),
 ('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000005','85000000-0000-4000-8000-000000000006',1,'85000000-0000-4000-8000-000000000013',3,'C',1,'Test');
insert into public.course_offerings(course_id,university_id,department_id,level_id,semester_id,status) values
 ('85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000006','85000000-0000-4000-8000-000000000009','published'),
 ('85000000-0000-4000-8000-000000000011','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000007','85000000-0000-4000-8000-000000000010','published'),
 ('85000000-0000-4000-8000-000000000014','85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000004','85000000-0000-4000-8000-000000000006','85000000-0000-4000-8000-000000000009','draft');

select ok(has_function_privilege('anon','public.get_lecturer_registration_courses_v1(uuid,uuid,uuid)','execute'),'public catalogue available before signup');
select ok(has_function_privilege('authenticated','public.get_lecturer_registration_courses_v1(uuid,uuid,uuid)','execute'),'applicants can load correction options');
set local role anon;
select is(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004'),
 '[{"id":"85000000-0000-4000-8000-000000000011","code":"LCT 101","title":"First course"},{"id":"85000000-0000-4000-8000-000000000012","code":"LCT 401","title":"Advanced course"}]'::jsonb,
 'all levels and semesters, unique courses, public fields only, excludes other departments and drafts');
select is(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000003','85000000-0000-4000-8000-000000000004'),'[]'::jsonb,'mismatched faculty cannot expose courses');
select is(public.get_lecturer_registration_courses_v1(gen_random_uuid(),'85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004'),'[]'::jsonb,'mismatched university returns no courses');
select is(public.get_lecturer_registration_courses_v1(null,null,null),'[]'::jsonb,'missing hierarchy returns no courses');
reset role;
update public.courses set active=false where code='LCT 401';
select is(jsonb_array_length(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004')),1,'inactive courses are excluded');
update public.curriculum_courses set active=false where course_id='85000000-0000-4000-8000-000000000011';
select is(jsonb_array_length(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004')),1,'published offerings are available without an active curriculum row');
update public.course_offerings set status='retired' where university_id='85000000-0000-4000-8000-000000000001';
select is(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004'),'[]'::jsonb,'retired offerings and inactive curriculum are excluded');
update public.curriculum_courses set active=true where course_id='85000000-0000-4000-8000-000000000011';
update public.departments set active=false where id='85000000-0000-4000-8000-000000000004';
select is(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004'),'[]'::jsonb,'inactive department is excluded');
update public.departments set active=true where id='85000000-0000-4000-8000-000000000004';
update public.faculties set active=false where id='85000000-0000-4000-8000-000000000002';
select is(public.get_lecturer_registration_courses_v1('85000000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000002','85000000-0000-4000-8000-000000000004'),'[]'::jsonb,'inactive faculty is excluded');
select * from finish();
rollback;
