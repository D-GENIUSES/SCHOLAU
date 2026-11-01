-- Computer Science is one department. Cybersecurity and Software Engineering
-- stay separate departments. Computing Sciences is not this department's name.

update public.departments
set name = 'Computer Science'
where name = 'Computing Sciences';

update public.departments
set name = 'Computer Science (fixture)'
where name = 'Computing Sciences (fixture)';

update public.lecturer_applications
set department = 'Computer Science'
where btrim(department) = 'Computing Sciences';
