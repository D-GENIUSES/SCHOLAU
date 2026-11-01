-- Official Adeleke department name. Historical migrations inserted "Computer Science";
-- course titles such as CSC 322 are unchanged. The local fixture department is not Adeleke.
update public.departments d
set name = 'Computing Sciences'
from public.faculties f
join public.universities u on u.id = f.university_id
where d.faculty_id = f.id
  and d.university_id = u.id
  and d.name = 'Computer Science'
  and f.name = 'Faculty of Science'
  and u.slug = 'adeleke-university-ede-osun-state';

update public.lecturer_applications
set department = 'Computing Sciences'
where btrim(department) = 'Computer Science';

update auth.users
set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{department}', '"Computing Sciences"', false)
where raw_user_meta_data->>'department' = 'Computer Science';
