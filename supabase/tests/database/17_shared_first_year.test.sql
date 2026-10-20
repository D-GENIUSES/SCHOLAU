begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc
do $$ declare u uuid; f uuid; l uuid; p uuid; s uuid; d uuid; student uuid; r record; cat jsonb; n integer; results jsonb:='[]'; begin
select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
select id into strict f from public.faculties where university_id=u and name='Faculty of Science';
select id into strict l from public.levels where university_id=u and label='100 Level';
select id into strict p from public.academic_periods where university_id=u and label='2026/2027';
for r in select * from (values('Cybersecurity',1,10,8,19),('Cybersecurity',2,8,7,17),('Software Engineering',1,10,8,19),('Software Engineering',2,8,7,17)) x(programme,semester,courses,required,units) loop
begin
select id into strict d from public.departments where university_id=u and name=r.programme;
select id into strict s from public.semesters where academic_period_id=p and sort_order=r.semester;
if exists(select 1 from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=d and cc.level_id=l and c.code in ('MTH 201','MTH 202')) then raise exception 'Upper-year maths assigned at 100 Level'; end if;
if (select count(*) from public.curriculum_courses cc join public.courses c on c.id=cc.course_id where cc.department_id=d and cc.level_id=l and cc.semester_number=r.semester and c.code=case when r.semester=1 then 'MTH 101' else 'MTH 102' end)<>1 then raise exception 'Missing first-year maths'; end if;
student:=gen_random_uuid();
insert into auth.users(id,email,raw_user_meta_data) values(student,student::text||'@shared-first-year.invalid','{"display_name":"First-year verification"}');
perform private.apply_academic_profile(student,student,u,f,d,l,p,s,'initial',null,null);
select count(*) into n from public.enrollments where user_id=student and ended_at is null;
if n<>r.required then raise exception 'Assignment mismatch for % semester %: %',r.programme,r.semester,n; end if;
if exists(select 1 from public.enrollments e join public.course_offerings o on o.id=e.offering_id where e.user_id=student and o.requirement_status='E') then raise exception 'Elective auto-assigned'; end if;
perform private.assign_required_courses(student);
if (select count(*) from public.enrollments where user_id=student and ended_at is null)<>r.required then raise exception 'Assignment replay duplicates'; end if;
perform set_config('request.jwt.claims',json_build_object('sub',student,'role','authenticated')::text,true);
perform set_config('request.jwt.claim.sub',student::text,true);
perform set_config('role','authenticated',true);
cat:=public.get_catalog_v1();
if jsonb_array_length(cat->'offerings')<>r.courses then raise exception 'Catalog mismatch'; end if;
select sum((x->>'unit_count')::integer) into n from jsonb_array_elements(cat->'offerings') x;
if n<>r.units then raise exception 'Units mismatch'; end if;
results:=results||jsonb_build_array(jsonb_build_object('programme',r.programme,'semester',r.semester,'courses',r.courses,'required_assigned',r.required,'passed',true));
raise exception using errcode='ZF001',message='Rollback verification student';
exception when sqlstate 'ZF001' then null; end;
end loop;
if exists(select 1 from auth.users where email like '%@shared-first-year.invalid') then raise exception 'Temporary user leak'; end if;
perform set_config('scholau.shared_first_year',results::text,true);
end $$;
select ok(jsonb_array_length(current_setting('scholau.shared_first_year')::jsonb)=4,'four CYB/SEN first-year profiles pass');
select * from finish();
rollback;
