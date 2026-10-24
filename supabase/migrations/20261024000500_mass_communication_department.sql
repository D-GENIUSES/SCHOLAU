-- Mass Communication under Faculty of Business and Social Sciences (registration catalogue).
-- Full handbook curriculum is seeded in 20261024000600_mass_communication_catalogue.sql.
insert into public.departments(university_id,faculty_id,name,active)
select u.id,f.id,'Mass Communication',true
from public.universities u
join public.faculties f on f.university_id=u.id and f.name='Faculty of Business and Social Sciences'
where u.slug='adeleke-university-ede-osun-state'
on conflict(faculty_id,name) do update set active=true;
