-- Run inside a transaction and roll back: no accounts or messages persist.
do $$
declare v jsonb; uid uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid(); before_level uuid;
begin
 if jsonb_array_length(public.get_registration_options_v1('adeleke-university-ede-osun-state')->'faculties')<>6 then raise exception 'Expected six faculties'; end if;
 if (select count(*) from public.departments d join public.faculties f on f.id=d.faculty_id join public.universities u on u.id=f.university_id where u.slug='adeleke-university-ede-osun-state' and f.name='Faculty of Science' and d.active)<>11 then raise exception 'Expected eleven science departments'; end if;
 if not has_function_privilege('anon','public.get_registration_options_v1(text)','execute') then raise exception 'Signup catalogue unavailable before login'; end if;
 select jsonb_build_object('universityId',u.id,'facultyId',f.id,'departmentId',d.id,'levelId',l.id,'academicPeriodId',a.id,'semesterId',s.id) into strict v
 from public.universities u join public.faculties f on f.university_id=u.id and f.name='Faculty of Science'
 join public.departments d on d.faculty_id=f.id and d.name='Computer Science'
 join public.levels l on l.university_id=u.id and l.active
 join public.academic_periods a on a.university_id=u.id and a.active
 join public.semesters s on s.academic_period_id=a.id and s.active
 where u.slug='adeleke-university-ede-osun-state' order by a.starts_on desc,l.sort_order,s.sort_order limit 1;
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(uid,'authenticated','authenticated',uid::text||'@example.invalid','{"provider":"email","providers":["email"]}',
 jsonb_build_object('username','test_'||left(replace(uid::text,'-',''),12),'display_name','Registration test','academic_profile',
 jsonb_build_object('universitySlug','adeleke-university-ede-osun-state','faculty','Faculty of Science','department','Computer Science','currentSemester','first','catalogProfile',v)),now(),now());
 if not exists(select 1 from public.profiles where id=uid and university_id=(v->>'universityId')::uuid and department_id=(v->>'departmentId')::uuid and semester_id=(v->>'semesterId')::uuid) then raise exception 'Registration choices were not saved to the academic profile'; end if;
 if (select count(*) from public.academic_profile_changes where user_id=uid and kind='initial')<>1 then raise exception 'Expected exactly one initial profile change'; end if;
 select level_id into before_level from public.profiles where id=uid;
 update auth.users set raw_user_meta_data=raw_user_meta_data||'{"display_name":"Updated registration test"}' where id=uid;
 if (select level_id from public.profiles where id=uid)<>before_level then raise exception 'Metadata update changed academic profile'; end if;
 if (select count(*) from public.academic_profile_changes where user_id=uid)<>1 then raise exception 'Academic profile initialized twice'; end if;
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(bad,'authenticated','authenticated',bad::text||'@example.invalid','{"provider":"email"}',
 jsonb_build_object('username','test_'||left(replace(bad::text,'-',''),12),'display_name','Invalid selection test','academic_profile',jsonb_build_object('universitySlug','adeleke-university-ede-osun-state','catalogProfile',v||jsonb_build_object('facultyId',gen_random_uuid()))),now(),now());
 if not exists(select 1 from public.profiles where id=bad and university_id is null) then raise exception 'Invalid selection assigned an academic profile'; end if;
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(legacy,'authenticated','authenticated',legacy::text||'@example.invalid','{"provider":"email"}',jsonb_build_object('username','test_'||left(replace(legacy::text,'-',''),12),'display_name','Legacy registration test'),now(),now());
 if not exists(select 1 from public.profiles where id=legacy and university_id is null) then raise exception 'Legacy signup compatibility failed'; end if;
end $$;
