-- Preserve the existing faculty identity and all academic relationships.
do $$
declare u uuid;
begin
 select id into strict u from public.universities where slug='adeleke-university-ede-osun-state';
 update public.faculties set name='Faculty of Science' where university_id=u and name='Computing Sciences';
 insert into public.faculties(university_id,name,active)
 select u,name,true from (values
 ('Faculty of Science'),('Faculty of Arts'),('Faculty of Business and Social Sciences'),
 ('Faculty of Engineering'),('Faculty of Basic Medical Sciences'),('Faculty of Law')) names(name)
 on conflict(university_id,name) do update set active=true;
end;
$$;
