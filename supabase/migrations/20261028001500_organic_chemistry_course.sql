-- Shared course identity for the supplied organic chemistry sources.
-- Departmental semester offerings require confirmed curriculum data.
insert into public.courses(code,title,description)
values ('CHM 102','General Chemistry II','Organic chemistry source aliases CHM 112/122 confirmed for this course.')
on conflict(code) do nothing;
