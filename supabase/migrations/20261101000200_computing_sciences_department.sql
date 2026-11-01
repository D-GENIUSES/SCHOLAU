-- The Faculty of Science department is Computing Sciences.
-- Course titles that mention computer science stay as published.

update public.departments
set name = 'Computing Sciences'
where name = 'Computer Science';

update public.departments
set name = 'Computing Sciences (fixture)'
where name = 'Computer Science (fixture)';

update public.lecturer_applications
set department = 'Computing Sciences'
where btrim(department) = 'Computer Science';
