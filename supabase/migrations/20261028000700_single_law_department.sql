-- Owner correction: Faculty of Law has one department, Law.
-- Remove only the two mistakenly added empty department rows.
do $$
declare university uuid; faculty uuid;
begin
 select id into strict university from public.universities where slug='adeleke-university-ede-osun-state';
 select id into strict faculty from public.faculties where university_id=university and name='Faculty of Law';
 if exists(select 1 from public.departments d where d.faculty_id=faculty and d.name in ('Private and Property Law','Public Law') and (
 exists(select 1 from public.profiles p where p.department_id=d.id) or
 exists(select 1 from public.course_offerings o where o.department_id=d.id) or
 exists(select 1 from public.curriculum_courses c where c.department_id=d.id))) then
 raise exception 'Unexpected references on the law departments being corrected'; end if;
 delete from public.departments where faculty_id=faculty and name in ('Private and Property Law','Public Law');
 if (select count(*) from public.departments where faculty_id=faculty and active)<>1 or
 not exists(select 1 from public.departments where faculty_id=faculty and name='Law' and active) then
 raise exception 'Expected Law to be the only active law department'; end if;
end $$;
