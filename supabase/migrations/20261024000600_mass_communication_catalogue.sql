-- Mass Communication curriculum transcribed from user-provided handbook photographs (100–400 Level).
-- Specialization electives are stored as E without elective_group so students can combine tracks to reach 18 units.
insert into public.departments(university_id,faculty_id,name,active)
select u.id,f.id,'Mass Communication',true
from public.universities u
join public.faculties f on f.university_id=u.id and f.name='Faculty of Business and Social Sciences'
where u.slug='adeleke-university-ede-osun-state'
on conflict(faculty_id,name) do update set active=true;

insert into public.courses(code,title) values
('CMS 101','Introduction to Human Communication'),
('CMS 102','Writing for the Media'),
('CMS 201','History of Nigerian Media'),
('CMS 301','Theories of Communication'),
('CMS 303','Foundations of Communication Research'),
('CMS 302','Data Analysis in Communication Research'),
('CMS 401','International Communication'),
('CMS 402','Communication and Society'),
('MCM 101','Foundations of Broadcasting and Film'),
('MCM 103','Introduction to Advertising'),
('MCM 105','Introduction to Book Publishing'),
('MCM 107','Introduction to Photojournalism'),
('MCM 102','Principles of Public Relation'),
('MCM 104','Introduction to News Writing'),
('MCM 106','African Communication Systems'),
('MCM 201','Critical and Reviewing Writing'),
('MCM 202','Editing and Graphics of Communication'),
('MCM 203','Feature Writing'),
('MCM 205','Techniques in Book Publishing'),
('MCM 207','Radio/TV News Reporting and Production'),
('MCM 209','Drama, Film and Documentary Production'),
('MCM 211','Basics of Screenwriting and Film Animation'),
('MCM 213','Writing for Public Relations'),
('MCM 215','Advertising Media Planning'),
('MCM 204','Advanced and Specialized Reporting'),
('MCM 206','Manuscript Editing, Layout and Design in Book Publishing'),
('MCM 208','Radio, TV Programme Writing'),
('MCM 210','Presentation and Performance'),
('MCM 212','Marketing Foundations for PRAD'),
('MCM 214','Advert Copywriting'),
('MCM 301','Mass Communication and Politics'),
('MCM 303','Gender and Communication'),
('MCM 305','Newspaper and Magazine Management and Production'),
('MCM 307','Photo Journalism Research Management'),
('MCM 309','Commentary, Critical Writing and Public Affairs Broadcasting'),
('MCM 311','Filming Production and Screen Directing'),
('MCM 313','Advertising and PR Research'),
('MCM 315','Consumer Affairs'),
('MCM 302','Online Journalism'),
('MCM 304','Foreign Correspondence'),
('MCM 306','Investigative Journalism'),
('MCM 308','Broadcast Programming, Management and Operation'),
('MCM 310','International and Foreign Broadcasting'),
('MCM 312','Organization and Management of Advertising and PR Agencies'),
('MCM 314','International Public Relations and Advertising'),
('MCM 401','Original Research Project'),
('MCM 402','Original Research Project'),
('MCM 403','Media Attachment'),
('MCM 404','Mass Media Ethics'),
('MCM 405','Mass Media Law'),
('MCM 406','Communication for Development'),
('MCM 407','Message Design for Development'),
('MCM 408','Community Media and Relations'),
('AUE-MCM 111','Introduction to Media Convergence'),
('AUE-MCM 108','Introduction to Development Comm.'),
('AUE-MCM 207','Public Comm. and Speech Writing'),
('AUE-MCM 211','Introduction to Sports Journalism'),
('AUE-MCM 208','Editorial Writing'),
('AUE-MCM 212','Statistical Methods and Sources in Communication'),
('AUE-MCM 319','Issues in Nigerian Mass Media'),
('AUE-MCM 316','Studio Production Techniques in Communication'),
('AUE-MCM 409','Integrated Marketing Communication'),
('AUE-MCM 413','Comparative Media Systems'),
('AUE-MCM 415','Communication Seminar'),
('AUE-MCM 410','Human Rights and Religious Communication'),
('AUE-MCM 412','Educational Broadcasting'),
('AUE-MCM 414','Online Journalism'),
('AUE-LIS 102','Introduction to Information Science'),
('AUE-GST 132','Contemporary Health Issues'),
('AUE-GST 212','Communication in French'),
('AUE-GST 232','Introduction to Agriculture')
on conflict(code) do update set title=excluded.title;

do $$
declare v_u uuid; r record;
begin
  select id into strict v_u from public.universities where slug='adeleke-university-ede-osun-state';
  insert into public.levels(university_id,label,sort_order) values
    (v_u,'400 Level',400)
  on conflict(university_id,label) do nothing;

  insert into public.curriculum_courses(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,
    position,source_reference,lecture_hours,practical_hours,elective_group,source_code,source_title)
  select v_u,d.id,l.id,src.semester,c.id,src.units,src.status,src.position,
    'User-provided Mass Communication handbook photographs, 2026/2027',src.lh,src.ph,null,src.code,src.title
  from (values
    (100,1,'AUE-GST 100',0,'R',1,null::integer,null::integer,'Student Life Seminar'),
    (100,1,'AUE-GST 101',2,'R',2,30,null,'Use of Library'),
    (100,1,'GST 111',2,'C',3,30,null,'Communication in English'),
    (100,1,'CMS 101',2,'C',4,30,null,'Introduction to Human Communication'),
    (100,1,'MCM 101',3,'C',5,30,15,'Foundations of Broadcasting and Film'),
    (100,1,'MCM 103',2,'C',6,30,null,'Introduction to Advertising'),
    (100,1,'MCM 105',2,'C',7,30,null,'Introduction to Book Publishing'),
    (100,1,'MCM 107',2,'C',8,30,null,'Introduction to Photojournalism'),
    (100,1,'AUE-MCM 111',3,'C',9,45,null,'Introduction to Media Convergence'),
    (100,2,'AUE-GST 100',0,'R',1,null,null,'Student Life Seminar'),
    (100,2,'AUE-GST 102',1,'R',2,15,null,'God in Modern Society'),
    (100,2,'AUE-GST 132',2,'R',3,30,null,'Contemporary Health Issues'),
    (100,2,'GST 112',2,'C',4,30,null,'Nigerian Peoples and Culture'),
    (100,2,'CMS 102',2,'C',5,30,null,'Writing for the Media'),
    (100,2,'MCM 102',2,'C',6,30,null,'Principles of Public Relation'),
    (100,2,'MCM 104',2,'C',7,30,null,'Introduction to News Writing'),
    (100,2,'MCM 106',2,'C',8,30,null,'African Communication Systems'),
    (100,2,'AUE-MCM 108',3,'C',9,45,null,'Introduction to Development Comm.'),
    (100,2,'AUE-LIS 102',2,'C',10,30,null,'Introduction to Information Science'),
    (200,1,'AUE-GST 200',0,'R',1,15,null,'Students Life Seminar'),
    (200,1,'ENT 211',2,'R',2,15,45,'Entrepreneurship and Innovation'),
    (200,1,'CMS 201',2,'C',3,30,null,'History of Nigerian Media'),
    (200,1,'MCM 201',2,'C',4,30,null,'Critical and Reviewing Writing'),
    (200,1,'AUE-GST 201',1,'R',5,15,null,'Philosophy of Education'),
    (200,1,'AUE-MCM 207',3,'C',6,30,null,'Public Comm. and Speech Writing'),
    (200,1,'AUE-MCM 211',3,'C',7,45,null,'Introduction to Sports Journalism'),
    (200,1,'MCM 203',3,'E',8,45,null,'Feature Writing'),
    (200,1,'MCM 205',2,'E',9,30,null,'Techniques in Book Publishing'),
    (200,1,'MCM 207',2,'E',10,30,null,'Radio/TV News Reporting and Production'),
    (200,1,'MCM 209',2,'E',11,30,null,'Drama, Film and Documentary Production'),
    (200,1,'MCM 211',2,'E',12,30,null,'Basics of Screenwriting and Film Animation'),
    (200,1,'MCM 213',2,'E',13,30,null,'Writing for Public Relations'),
    (200,1,'MCM 215',2,'E',14,30,null,'Advertising Media Planning'),
    (200,2,'GST 212',2,'R',1,null,null,'Philosophy, Logic and Human Existence'),
    (200,2,'MCM 202',3,'C',2,null,null,'Editing and Graphics of Communication'),
    (200,2,'AUE-GST 212',2,'C',3,null,null,'Communication in French'),
    (200,2,'AUE-GST 200',0,'R',4,null,null,'Students Life Seminar'),
    (200,2,'AUE-GST 202',1,'R',5,null,null,'Life and Teaching of Christ'),
    (200,2,'AUE-GST 232',2,'R',6,null,null,'Introduction to Agriculture'),
    (200,2,'AUE-MCM 208',3,'C',7,null,null,'Editorial Writing'),
    (200,2,'AUE-MCM 212',2,'C',8,null,null,'Statistical Methods and Sources in Communication'),
    (200,2,'MCM 204',3,'E',9,null,null,'Advanced and Specialized Reporting'),
    (200,2,'MCM 206',2,'E',10,null,null,'Manuscript Editing, Layout and Design in Book Publishing'),
    (200,2,'MCM 208',2,'E',11,null,null,'Radio, TV Programme Writing'),
    (200,2,'MCM 210',2,'E',12,null,null,'Presentation and Performance'),
    (200,2,'MCM 212',2,'E',13,null,null,'Marketing Foundations for PRAD'),
    (200,2,'MCM 214',2,'E',14,null,null,'Advert Copywriting'),
    (300,1,'CMS 301',2,'C',1,null,null,'Theories of Communication'),
    (300,1,'CMS 303',2,'C',2,null,null,'Foundations of Communication Research'),
    (300,1,'MCM 301',2,'C',3,null,null,'Mass Communication and Politics'),
    (300,1,'MCM 303',2,'C',4,null,null,'Gender and Communication'),
    (300,1,'MCM 305',2,'C',5,null,null,'Newspaper and Magazine Management and Production'),
    (300,1,'AUE-MCM 319',3,'C',6,null,null,'Issues in Nigerian Mass Media'),
    (300,1,'MCM 307',2,'E',7,null,null,'Photo Journalism Research Management'),
    (300,1,'MCM 309',2,'E',8,null,null,'Commentary, Critical Writing and Public Affairs Broadcasting'),
    (300,1,'MCM 311',2,'E',9,null,null,'Filming Production and Screen Directing'),
    (300,1,'MCM 313',2,'E',10,null,null,'Advertising and PR Research'),
    (300,1,'MCM 315',2,'E',11,null,null,'Consumer Affairs'),
    (300,2,'GST 312',2,'R',1,30,null,'Peace and Conflict Resolution'),
    (300,2,'ENT 312',2,'C',2,15,null,'Venture Creation'),
    (300,2,'CMS 302',2,'C',3,30,null,'Data Analysis in Communication Research'),
    (300,2,'MCM 302',2,'C',4,30,null,'Online Journalism'),
    (300,2,'AUE-MCM 316',3,'C',5,45,null,'Studio Production Techniques in Communication'),
    (300,2,'MCM 304',2,'E',6,30,null,'Foreign Correspondence'),
    (300,2,'MCM 306',2,'E',7,30,null,'Investigative Journalism'),
    (300,2,'MCM 308',2,'E',8,null,null,'Broadcast Programming, Management and Operation'),
    (300,2,'MCM 310',2,'E',9,null,null,'International and Foreign Broadcasting'),
    (300,2,'MCM 312',2,'E',10,null,null,'Organization and Management of Advertising and PR Agencies'),
    (300,2,'MCM 314',2,'E',11,null,null,'International Public Relations and Advertising'),
    (400,1,'AUE-MCM 409',3,'C',1,null,null,'Integrated Marketing Communication'),
    (400,1,'CMS 401',2,'C',2,null,null,'International Communication'),
    (400,1,'MCM 401',2,'C',3,null,null,'Original Research Project'),
    (400,1,'MCM 403',2,'C',4,null,null,'Media Attachment'),
    (400,1,'MCM 405',2,'C',5,null,null,'Mass Media Law'),
    (400,1,'MCM 407',2,'C',6,null,null,'Message Design for Development'),
    (400,1,'AUE-MCM 413',3,'E',7,null,null,'Comparative Media Systems'),
    (400,1,'AUE-MCM 415',3,'E',8,null,null,'Communication Seminar'),
    (400,2,'AUE-MCM 410',3,'E',1,null,null,'Human Rights and Religious Communication'),
    (400,2,'AUE-MCM 412',3,'E',2,null,null,'Educational Broadcasting'),
    (400,2,'CMS 402',2,'C',3,null,null,'Communication and Society'),
    (400,2,'MCM 402',2,'C',4,null,null,'Original Research Project'),
    (400,2,'MCM 404',2,'C',5,null,null,'Mass Media Ethics'),
    (400,2,'MCM 406',2,'C',6,null,null,'Communication for Development'),
    (400,2,'MCM 408',2,'C',7,null,null,'Community Media and Relations'),
    (400,2,'AUE-MCM 414',2,'C',8,null,null,'Online Journalism')
  ) src(level,semester,code,units,status,position,lh,ph,title)
  join public.departments d on d.university_id=v_u and d.name='Mass Communication'
  join public.faculties f on f.id=d.faculty_id and f.name='Faculty of Business and Social Sciences'
  join public.levels l on l.university_id=v_u and l.label=src.level::text||' Level'
  join public.courses c on c.code=src.code
  on conflict(department_id,level_id,semester_number,course_id) do update set
    unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
    source_reference=excluded.source_reference,lecture_hours=excluded.lecture_hours,practical_hours=excluded.practical_hours,
    elective_group=excluded.elective_group,source_code=excluded.source_code,source_title=excluded.source_title,active=true;

  if (select count(*) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      where d.university_id=v_u and d.name='Mass Communication' and cc.active)<>85
    then raise exception 'Expected 85 Mass Communication curriculum rows'; end if;

  if (select count(*) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Mass Communication' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>9
    then raise exception 'Expected 9 Mass Communication 100 Level first-semester courses'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Mass Communication' and l.label='100 Level' and cc.semester_number=1 and cc.active)<>18
    then raise exception 'Expected 18 Mass Communication 100 Level first-semester units'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Mass Communication' and l.label='100 Level' and cc.semester_number=2 and cc.active)<>18
    then raise exception 'Expected 18 Mass Communication 100 Level second-semester units'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Mass Communication' and l.label='200 Level' and cc.semester_number=1
        and cc.active and cc.requirement_status in ('C','R'))<>13
    then raise exception 'Expected 13 Mass Communication 200 Level first-semester core units'; end if;
  if (select sum(cc.unit_count) from public.curriculum_courses cc join public.departments d on d.id=cc.department_id
      join public.levels l on l.id=cc.level_id
      where d.university_id=v_u and d.name='Mass Communication' and l.label='200 Level' and cc.semester_number=2
        and cc.active and cc.requirement_status in ('C','R'))<>15
    then raise exception 'Expected 15 Mass Communication 200 Level second-semester core units'; end if;

  for r in select s.id from public.semesters s
    join public.academic_periods ap on ap.id=s.academic_period_id and ap.active
    where s.university_id=v_u and s.active
  loop
    perform private.materialize_curriculum(r.id);
  end loop;
end;
$$;
