-- Philosophy of Education is one shared course, so every AUE-GST 201 offering reads the same lessons and questions.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select is((select count(*)::integer from public.courses where code='AUE-GST 201'),1,'AUE-GST 201 remains a single course');
select is((select title from public.courses where code='AUE-GST 201'),'Philosophy of Education','course title unchanged');
select is((select count(distinct o.course_id)::integer from public.course_offerings o join public.courses c on c.id=o.course_id where c.code='AUE-GST 201'),1,'offerings share one course id');
select is((select count(*)::integer from public.lessons l join public.courses c on c.id=l.course_id where c.code='AUE-GST 201'),6,'six chapters live on the course');
select is((select count(*)::integer from public.lesson_versions lv join public.lessons l on l.id=lv.lesson_id join public.courses c on c.id=l.course_id where c.code='AUE-GST 201' and lv.version=1 and jsonb_array_length(lv.blocks)>0),6,'each chapter has study notes');
select is((select count(*)::integer from public.questions q join public.courses c on c.id=q.course_id where c.code='AUE-GST 201' and q.pool='learning'),44,'44 keyed learning questions');
select is((select count(*)::integer from public.questions q join public.courses c on c.id=q.course_id where c.code='AUE-GST 201' and q.pool='battle'),44,'44 battle questions with real four-option sets');
select is((select count(*)::integer from public.question_options o join public.question_versions qv on qv.id=o.question_version_id join public.questions q on q.id=qv.question_id join public.courses c on c.id=q.course_id where c.code='AUE-GST 201' and q.pool='battle'),176,'battle questions keep exactly four options');
select ok(not exists(select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id join public.courses c on c.id=q.course_id where c.code='AUE-GST 201' and q.pool='learning' and not (qv.usage @> array['review','practice']::text[])), 'learning questions are usable in review and practice');
select ok(not exists(select 1 from public.question_versions qv join public.questions q on q.id=qv.question_id join public.courses c on c.id=q.course_id where c.code='AUE-GST 201' and q.pool='battle' and qv.usage <> array['battle']::text[]),'battle questions stay in the battle pool');
select is((select count(*)::integer from public.assessments a join public.courses c on c.id=a.course_id where c.code='AUE-GST 201' and a.kind='review'),6,'each chapter has a review');
select is((select count(*)::integer from public.assessments a join public.courses c on c.id=a.course_id where c.code='AUE-GST 201' and a.kind='practice'),1,'one course practice covers the keyed questions');
select * from finish();
rollback;
