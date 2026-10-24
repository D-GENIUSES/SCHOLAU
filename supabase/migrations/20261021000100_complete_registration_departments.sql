-- Department names supplied by the catalogue owner for student registration.
do $$
declare
  university uuid;
  faculty uuid;
  item record;
begin
  select id into strict university from public.universities
    where slug = 'adeleke-university-ede-osun-state';
  for item in select * from (values
    ('Faculty of Business and Social Sciences', 'Economics'),
    ('Faculty of Business and Social Sciences', 'Accounting'),
    ('Faculty of Business and Social Sciences', 'Public Administration'),
    ('Faculty of Business and Social Sciences', 'Business Administration'),
    ('Faculty of Law', 'Law'),
    ('Faculty of Basic Medical Sciences', 'Anatomy'),
    ('Faculty of Basic Medical Sciences', 'Nursing'),
    ('Faculty of Basic Medical Sciences', 'Public Health'),
    ('Faculty of Basic Medical Sciences', 'Physiology'),
    ('Faculty of Engineering', 'Mechanical Engineering'),
    ('Faculty of Engineering', 'Electrical Engineering'),
    ('Faculty of Engineering', 'Chemical Engineering')
  ) departments(faculty_name, department_name)
  loop
    select id into strict faculty from public.faculties
      where university_id = university and name = item.faculty_name and active;
    insert into public.departments (university_id, faculty_id, name, active)
      values (university, faculty, item.department_name, true)
      on conflict (faculty_id, name) do update set active = true;
  end loop;
end;
$$;
;
