-- NSC COURSE LIST.pdf, pp. 24-33: Adeleke University Nursing Sciences.
-- 200-level first semester was published by 20261028001800_nursing_200_first_semester.sql.
-- Vacation/inter-semester postings are attached to the preceding level's second semester,
-- because the catalogue has only first and second semester slots.
create temp table nsc_requested (
  level integer, semester integer, code text, title text, units integer,
  requirement_status text, position integer, note text
) on commit drop;
insert into nsc_requested values
(100,1,'GST 111','Communication in English I',2,'C',1,null),
(100,1,'AUE-GST 100','Students Life Seminar',0,'R',2,null),
(100,1,'AUE-GST 101','Use of Library & Study Skills',2,'C',3,null),
(100,1,'AUE-GST 131','Environment and Sustainable Development',2,'C',4,null),
(100,1,'BIO 101','General Biology I',2,'C',5,null),
(100,1,'BIO 107','Biology Practical I',1,'C',6,null),
(100,1,'CHM 101','General Chemistry I',2,'C',7,null),
(100,1,'CHM 107','Experimental Chemistry I',1,'C',8,null),
(100,1,'PHY 101','General Physics I',2,'C',9,null),
(100,1,'PHY 107','Experimental Physics I',1,'C',10,null),
(100,1,'MTH 101','General Mathematics I',2,'C',11,null),
(100,1,'COS 101','Introduction to Computing Science',3,'C',12,null),
(100,2,'GST 112','Nigerian Peoples and Culture',2,'C',1,null),
(100,2,'AUE-GST 102','God in Modern Society',1,'R',2,null),
(100,2,'AUE-GST 132','Contemporary Health Issues',2,'C',3,null),
(100,2,'BIO 102','General Biology II',2,'C',4,null),
(100,2,'BIO 108','Biology Practical II',1,'C',5,null),
(100,2,'CHM 102','General Chemistry II',2,'C',6,null),
(100,2,'CHM 108','Experimental Chemistry II',1,'C',7,null),
(100,2,'PHY 102','General Physics II',2,'C',8,null),
(100,2,'PHY 108','Experimental Physics II',1,'C',9,null),
(100,2,'AUE-MTH 102','Elementary Mathematics II',3,'C',10,null),
(100,2,'AUE-STA 102','Elementary Statistics',2,'C',11,null),
(200,2,'GST 212','Philosophy, Logic and Human Existence',2,'C',1,null),
(200,2,'AUE-GES 200','Student Life Seminar',1,'R',2,null),
(200,2,'ANA 204','Anatomy of Thorax, Abdomen, Pelvis and Perineum',2,'C',3,null),
(200,2,'AUE-ANA 206','Anatomy of Head and Neck',1,'C',4,null),
(200,2,'AUE-ANA 212','Anatomy Practical II',1,'C',5,null),
(200,2,'BCH 202','General and Medical Biochemistry II',2,'C',6,null),
(200,2,'AUE-BCH 210','General and Medical Biochemistry II Practical',1,'C',7,'Printed title has a handwritten Experimental correction.'),
(200,2,'PIO 212','Renal and Body Fluids Physiology',2,'C',8,null),
(200,2,'AUE-PIO 206','Physiology of the Body Systems',2,'C',9,null),
(200,2,'AUE-PIO 218','Physiology Practical II',1,'C',10,null),
(200,2,'NSC 202','Foundation of Professional Nursing Practice II (including Introduction to Health/Nursing Informatics)',2,'C',11,null),
(200,2,'AUE-NSC 212','Foundation of Professional Nursing Practical II',1,'C',12,null),
(200,2,'NSC 206','General and Cellular Pathology',2,'C',13,null),
(200,2,'AUE-NSC 208','Communications and Public Relations in Nursing',1,'C',14,null),
(200,2,'AUE-NSC 210','Introduction to Critical Thinking & Nursing Process',1,'C',15,null),
(200,2,'AUE-NSC 216','Sociology in Healthcare Practice',2,'C',16,null),
(200,2,'AUE-NSC 299','Concentrated Clinical Experience (SIWES)',4,'C',17,'Pre-300 long vacation; 8-week foundation of nursing posting.'),
(300,1,'PHA 301','Pharmacodynamics and Chemotherapy I (Clinical Pharmacology & Therapeutics I)',2,'C',1,null),
(300,1,'NSC 301','Epidemiology',1,'C',2,null),
(300,1,'NSC 303','Community/Public Health Nursing I',2,'C',3,null),
(300,1,'NSC 307','Human Nutrition',2,'C',4,null),
(300,1,'NSC 309','Nursing Ethics and Jurisprudence',2,'C',5,null),
(300,1,'NSC 313','Medical-Surgical Nursing I',2,'C',6,null),
(300,1,'AUE-NSC 313','Medical-Surgical Nursing I Practical',1,'C',7,null),
(300,1,'AUE-NSC 315','Medical Microbiology and Parasitology',2,'C',8,null),
(300,1,'AUE-NSC 317','Social and Behavioural Sciences in Health & Illness',2,'C',9,null),
(300,1,'AUE-NSC 321','Evidence-Based Practice in Nursing',2,'C',10,null),
(300,1,'AUE-NSC 323','Health and Physical Assessment in Nursing',2,'C',11,null),
(300,1,'AUE-NSC 325','Perspectives in Nursing (including Religious & Social)',2,'C',12,null),
(300,1,'AUE-NSC 303','Community Health Nursing Practical',1,'C',13,'Handwritten addition in source; code appears as AUE-NSC 303.'),
(300,2,'GST 312','Peace and Conflict Resolution',2,'C',1,null),
(300,2,'ENT 312','Venture Creation',2,'C',2,null),
(300,2,'PHA 302','Pharmacodynamics and Chemotherapy II (Clinical Pharmacology & Therapeutics II)',2,'C',3,null),
(300,2,'NSC 302','Community/Public Health Nursing II',1,'C',4,null),
(300,2,'AUE-NSC 312','Community/Public Health Nursing II Practical',1,'C',5,null),
(300,2,'NSC 306','Medical-Surgical Nursing II',2,'C',6,null),
(300,2,'NSC 308','Medical-Surgical Nursing III',2,'C',7,null),
(300,2,'AUE-NSC 310','Medical-Surgical Nursing II & III Practical',2,'C',8,null),
(300,2,'NSC 314','Mental Health Nursing I',3,'C',9,null),
(300,2,'AUE-NSC 316','Environmental Health',2,'C',10,null),
(300,2,'AUE-NSC 318','Epidemiology II',1,'C',11,null),
(300,2,'AUE-NSC 320','Introduction to Research Methodology & Professional Writing in Nursing',1,'C',12,null),
(300,2,'AUE-NSC 322','Introduction to Maternal and Child Health Nursing',2,'C',13,null),
(300,2,'NSC 312','Medical Surgical Nursing Practicum II (SIWES)',2,'C',14,'Inter-semester clinical posting; 3 weeks.'),
(300,2,'AUE-NSC 399','Medical Surgical Nursing Practicum II Concentrated Clinical Experience (SIWES)',6,'C',15,'Pre-400 long vacation; 10 weeks, including 8 medical-surgical and 2 community/public health.'),
(400,1,'NSC 401','Medical and Surgical Nursing Practicum III',3,'C',1,null),
(400,1,'NSC 403','Maternal and Child Health II',2,'C',2,null),
(400,1,'AUE-NSC 413','Maternal and Child Health II Practical',1,'C',3,null),
(400,1,'NSC 405','Mental Health Nursing II',2,'C',4,null),
(400,1,'NSC 409','Research Methodology',2,'C',5,null),
(400,1,'NSC 411','Management of Nursing Services',2,'C',6,null),
(400,1,'AUE-NSC 411','Practicum in Management of Nursing Services',1,'C',7,null),
(400,1,'PHE 403','Biostatistics (including Introduction to Health/Nursing Informatics I)',1,'C',8,null),
(400,1,'AUE-NSC 415','Medical-Surgical Nursing IV',3,'C',9,null),
(400,1,'AUE-NSC 417','Medical-Surgical Nursing IV Practical',1,'C',10,null),
(400,1,'AUE-NSC 419','Health Education & Promotion',2,'C',11,null),
(400,1,'AUE-NSC 421','Home (Domiciliary) Health Care Nursing',2,'C',12,null),
(400,2,'NSC 402','Maternal and Child Health Nursing III',2,'C',1,null),
(400,2,'NSC 404','Maternal and Child Health Nursing Practicum I',2,'C',2,null),
(400,2,'AUE-NSC 414','Maternal and Child Health Nursing (Emergency Obstetric Care)',2,'C',3,null),
(400,2,'NSC 406','Curriculum Development and Teaching Methodology',2,'C',4,null),
(400,2,'AUE-NSC 416','Practicum in Curriculum Development and Teaching Methodology',1,'C',5,null),
(400,2,'NSC 410','Community/Public Health Nursing III',2,'C',6,null),
(400,2,'AUE-NSC 412','Community/Public Health Nursing III Practical',1,'C',7,null),
(400,2,'AUE-NSC 420','Medical Surgical Nursing IV',3,'C',8,null),
(400,2,'AUE-NSC 422','Medical Surgical Nursing IV Clinical',1,'C',9,null),
(400,2,'AUE-NSC 424','Mental Health & Psychiatric Nursing III',3,'C',10,null),
(400,2,'AUE-NSC 426','Integrated Management of Neonatal and Childhood Diseases',2,'C',11,null),
(400,2,'AUE-NSC 428','Quality Improvement in Healthcare and Patient Safety',2,'C',12,null),
(400,2,'AUE-NSC 499','Concentrated Clinical Experience (SIWES)',6,'C',13,'Pre-500 long vacation; 12 weeks: maternal/child, medical-surgical and mental health postings.'),
(500,1,'NSC 501','Community/Public Health Nursing II Practicum',2,'C',1,null),
(500,1,'NSC 503','Maternal and Child Health Practicum II',2,'C',2,null),
(500,1,'NSC 505','Maternal and Child Health Nursing III (Complications in Midwifery)',2,'C',3,null),
(500,1,'NSC 509','Health and Nursing Informatics',2,'C',4,null),
(500,1,'NSC 511','Nursing Seminars',2,'C',5,null),
(500,1,'NSC 513','Health Economics',2,'C',6,null),
(500,1,'AUE-NSC 515','Life Saving Skills in Nursing',2,'C',7,null),
(500,1,'AUE-NSC 517','Introduction to Monitoring and Evaluation of Health Programmes and Services',2,'C',8,null),
(500,1,'AUE-NSC 519','Rural Community Health Nursing Practicum',2,'C',9,'University-adopted Jagun-Jagun Community, Ede North LGA.'),
(500,1,'AUE-NSC 551','Nursing Elective I',4,'E',10,'Choose one: Anaesthetic; Geriatric; Intensive Care; Operating Theatre; Ophthalmic; Orthopaedic; Paediatric and Child Health; Primary Health Care; Renal Care Nursing.'),
(500,2,'NSC 502','Maternal and Child Health Nursing Practicum IV',3,'C',1,null),
(500,2,'NSC 504','Community/Public Health Nursing IV',2,'C',2,null),
(500,2,'NSC 506','Community/Public Health Nursing Practicum III',2,'C',3,null),
(500,2,'NSC 508','Entrepreneurship in Nursing',2,'C',4,null),
(500,2,'AUE-NSC 518','Occupational Health in Local Industries in Osun State',3,'C',5,'Aso-Oke weaving, tie and dye, gold mining.'),
(500,2,'NSC 510','Research Project',4,'C',6,null),
(500,2,'AUE-NSC 599','Research Project II',2,'C',7,null),
(500,2,'AUE-NSC 552','Nursing Elective II',4,'E',8,'Choose one: Accident and Emergency; Burns and Plastic; Dermatological; Genetic Diseases; Occupational Health; Oncology; Oto-Rhino-Laryngology; Peri-Operative Nursing.');

create temp table nsc_scope on commit drop as
select d.id department_id, d.university_id, l.id level_id, l.sort_order level,
       s.id semester_id, s.sort_order semester
from public.departments d
join public.universities u on u.id=d.university_id
join public.levels l on l.university_id=u.id and l.active and l.sort_order in (100,200,300,400,500)
join public.academic_periods ap on ap.university_id=u.id and ap.active and ap.label='2026/2027'
join public.semesters s on s.academic_period_id=ap.id and s.active and s.sort_order in (1,2)
where u.slug='adeleke-university-ede-osun-state' and d.name='Nursing Sciences' and d.active;
do $$ begin
  if (select count(*) from nsc_scope)<>10 then raise exception 'Expected Nursing Sciences in 10 level/semester slots'; end if;
  if exists(select 1 from nsc_requested group by level,semester,code having count(*)>1) then raise exception 'Duplicate Nursing course code in semester'; end if;
  if exists(select 1 from nsc_requested where units<0 or units>6 or requirement_status not in ('C','R','E')) then raise exception 'Invalid Nursing course row'; end if;
  if (select sum(units) from nsc_requested where level=100 and semester=1)<>20
  or (select sum(units) from nsc_requested where level=100 and semester=2)<>19
  or (select sum(units) from nsc_requested where level=200 and semester=2 and code<>'AUE-NSC 299')<>24
  or (select sum(units) from nsc_requested where level=300 and semester=1)<>23
  or (select sum(units) from nsc_requested where level=300 and semester=2 and code not in ('NSC 312','AUE-NSC 399'))<>23
  or (select sum(units) from nsc_requested where level=400 and semester=1)<>22
  or (select sum(units) from nsc_requested where level=400 and semester=2 and code<>'AUE-NSC 499')<>23
  or (select sum(units) from nsc_requested where level=500 and semester=1)<>22
  or (select sum(units) from nsc_requested where level=500 and semester=2)<>22 then
    raise exception 'Nursing semester unit totals do not match source';
  end if;
end $$;

insert into public.courses(code,title,description)
select distinct on (code) code,title,
       case when code in ('AUE-NSC 551','AUE-NSC 552') then note else null end
from nsc_requested order by code,level,semester
on conflict(code) do update set description=excluded.description
where public.courses.code in ('AUE-NSC 551','AUE-NSC 552');
insert into public.curriculum_courses
(university_id,department_id,level_id,semester_number,course_id,unit_count,requirement_status,position,source_reference,source_code,source_title)
select s.university_id,s.department_id,s.level_id,r.semester,c.id,r.units,r.requirement_status,r.position,
       'NSC COURSE LIST.pdf, pages 24-33. '||coalesce(r.note,''),r.code,r.title
from nsc_requested r join nsc_scope s using(level,semester) join public.courses c on c.code=r.code
on conflict(department_id,level_id,semester_number,course_id) do update set
unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,position=excluded.position,
source_reference=excluded.source_reference,source_code=excluded.source_code,source_title=excluded.source_title,active=true;
insert into public.course_offerings
(course_id,university_id,department_id,level_id,semester_id,status,unit_count,requirement_status,source_code,source_title)
select c.id,s.university_id,s.department_id,s.level_id,s.semester_id,'published',r.units,r.requirement_status,r.code,r.title
from nsc_requested r join nsc_scope s using(level,semester) join public.courses c on c.code=r.code
on conflict(course_id,department_id,level_id,semester_id) do update set
status='published',unit_count=excluded.unit_count,requirement_status=excluded.requirement_status,
source_code=excluded.source_code,source_title=excluded.source_title;
do $$ begin
  if (select count(*) from nsc_requested r join nsc_scope s using(level,semester)
      join public.courses c on c.code=r.code join public.course_offerings o
        on o.course_id=c.id and o.department_id=s.department_id and o.level_id=s.level_id and o.semester_id=s.semester_id
      where o.status='published' and o.unit_count=r.units and o.requirement_status=r.requirement_status and o.source_title=r.title)
     <>(select count(*) from nsc_requested) then raise exception 'Nursing offerings verification failed'; end if;
end $$;
