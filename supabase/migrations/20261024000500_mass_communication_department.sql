-- Mass Communication under Faculty of Business and Social Sciences (registration catalogue).
-- Curriculum rows can be added in a follow-up migration when a verified course list is available.
insert into public.departments(university_id,faculty_id,name,active)
select u.id,f.id,'Mass Communication',true
from public.universities u
join public.faculties f on f.university_id=u.id and f.name='Faculty of Business and Social Sciences'
where u.slug='adeleke-university-ede-osun-state'
on conflict(faculty_id,name) do update set active=true;
