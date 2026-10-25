-- Catalogue supplied by the owner on 25 October 2026.
-- Add missing entries, preserve established department IDs and all offerings.
-- Existing Law and Biological Science are retained; no curriculum is inferred.
create temp table requested_university_departments(faculty text, department text) on commit drop;
insert into requested_university_departments values
('Faculty of Science','Biochemistry'),
('Faculty of Science','Chemistry'),
('Faculty of Science','Computer Science'),
('Faculty of Science','Software Engineering'),
('Faculty of Science','Cybersecurity'),
('Faculty of Science','Information Technology'),
('Faculty of Science','Computer Information Systems'),
('Faculty of Science','Mathematics'),
('Faculty of Science','Microbiology'),
('Faculty of Science','Physics'),
('Faculty of Science','Food Science and Technology'),
('Faculty of Engineering','Agricultural and Biosystems Engineering'),
('Faculty of Engineering','Chemical Engineering'),
('Faculty of Engineering','Civil Engineering'),
('Faculty of Engineering','Computer Engineering'),
('Faculty of Engineering','Electrical and Electronics Engineering'),
('Faculty of Engineering','Mechanical Engineering'),
('Faculty of Basic Medical Sciences','Anatomy'),
('Faculty of Basic Medical Sciences','Health Information Management'),
('Faculty of Basic Medical Sciences','Medical Laboratory Science'),
('Faculty of Basic Medical Sciences','Nursing Sciences'),
('Faculty of Basic Medical Sciences','Physiology'),
('Faculty of Basic Medical Sciences','Public Health'),
('Faculty of Business and Social Sciences','Accounting'),
('Faculty of Business and Social Sciences','Business Administration'),
('Faculty of Business and Social Sciences','Economics'),
('Faculty of Business and Social Sciences','Finance / Banking and Finance'),
('Faculty of Business and Social Sciences','Library and Information Science'),
('Faculty of Business and Social Sciences','Mass Communication'),
('Faculty of Business and Social Sciences','Office and Information Management'),
('Faculty of Business and Social Sciences','Political Science'),
('Faculty of Business and Social Sciences','Public Administration'),
('Faculty of Arts','History and International Studies'),
('Faculty of Arts','Languages and Literary Studies'),
('Faculty of Arts','Religious Studies'),
('Faculty of Arts','Theatre Arts'),
('Faculty of Law','Private and Property Law'),
('Faculty of Law','Public Law'),
('College of Medicine','Medicine and Surgery (MBBS)'),
('College of Pharmacy','Pharmacy (PharmD)');
create temp table preserved_catalogue_offerings on commit drop as select * from public.course_offerings;
create temp table preserved_catalogue_curriculum on commit drop as select * from public.curriculum_courses;
create temp table preserved_catalogue_departments on commit drop as select id,university_id,faculty_id from public.departments;

do $$
declare university uuid; item record; target_faculty uuid;
begin
 select id into strict university from public.universities where slug='adeleke-university-ede-osun-state';
 insert into public.faculties(university_id,name,active)
 select distinct university,faculty,true from requested_university_departments
 on conflict(university_id,name) do update set active=true;

 for item in select * from (values
 ('Faculty of Science','Computer Information System','Computer Information Systems'),
 ('Faculty of Engineering','Electrical Engineering','Electrical and Electronics Engineering'),
 ('Faculty of Basic Medical Sciences','Nursing','Nursing Sciences')
 ) aliases(faculty,old_name,new_name)
 loop
  select id into strict target_faculty from public.faculties where university_id=university and name=item.faculty;
  if exists(select 1 from public.departments where faculty_id=target_faculty and name=item.old_name)
     and not exists(select 1 from public.departments where faculty_id=target_faculty and name=item.new_name) then
   update public.departments set name=item.new_name,active=true where faculty_id=target_faculty and name=item.old_name;
  end if;
 end loop;

 insert into public.departments(university_id,faculty_id,name,active)
 select university,f.id,r.department,true from requested_university_departments r
 join public.faculties f on f.university_id=university and f.name=r.faculty
 on conflict(faculty_id,name) do update set active=true;

 if (select count(*) from requested_university_departments r join public.faculties f on f.university_id=university and f.name=r.faculty and f.active join public.departments d on d.faculty_id=f.id and d.name=r.department and d.active)<>40 then
  raise exception 'The complete requested 40-department catalogue was not installed';
 end if;
 if exists((select * from preserved_catalogue_offerings except select * from public.course_offerings) union all (select * from public.course_offerings except select * from preserved_catalogue_offerings)) then
  raise exception 'Existing offerings changed';
 end if;
 if exists((select * from preserved_catalogue_curriculum except select * from public.curriculum_courses) union all (select * from public.curriculum_courses except select * from preserved_catalogue_curriculum)) then
  raise exception 'Existing curricula changed';
 end if;
 if exists(select * from preserved_catalogue_departments except select id,university_id,faculty_id from public.departments) then
  raise exception 'An existing department identity changed';
 end if;
end;
$$;
