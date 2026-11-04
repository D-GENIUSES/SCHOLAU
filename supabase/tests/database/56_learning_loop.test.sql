-- Release integration: execute checked RPCs as real API roles; roll back every fixture.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
end $$;
select set_config('r.student','90000000-0000-4000-8000-000000000001',true);
select set_config('r.admin','90000000-0000-4000-8000-000000000002',true);
select set_config('r.offering','20000000-0000-4000-8000-000000000002',true);
select set_config('r.lesson','22000000-0000-4000-8000-000000000001',true);
select set_config('r.outsider',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data)
values(current_setting('r.outsider')::uuid,current_setting('r.outsider')||'@release.test','{"display_name":"Release outsider"}');

select pg_temp.login(current_setting('r.outsider')::uuid);
set local role authenticated;
select throws_ok($$select public.get_course_topic_mastery_v1(current_setting('r.offering')::uuid)$$,
  'PT403','NOT_ENROLLED','unenrolled student cannot read course mastery');
select throws_ok($$select public.can_submit_student_material_v1(current_setting('r.offering')::uuid)$$,
  'PT403','NOT_ENROLLED','unenrolled student cannot submit material');
select throws_ok($$select public.submit_lesson_video_v1(current_setting('r.lesson')::uuid,'abcdefghijk','Suggested clip',0,null)$$,
  'PT403','FORBIDDEN','unenrolled student cannot suggest a video');
reset role;

select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select lives_ok($$select public.get_course_topic_mastery_v1(current_setting('r.offering')::uuid)$$,
  'enrolled student can read course mastery');
select is((public.can_submit_student_material_v1(current_setting('r.offering')::uuid)->>'allowed')::boolean,
  true,'enrolled student can submit a source');
select throws_ok($$select public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)$$,
  'PT403','FORBIDDEN','student cannot inspect class outcomes');
select throws_ok($$select public.create_light_assignment_v1(current_setting('r.offering')::uuid,'Unauthorized',
  current_setting('r.lesson')::uuid,null,now()+interval '1 day')$$,
  'PT403','FORBIDDEN','student cannot create assignments');
select set_config('r.video',(public.submit_lesson_video_v1(current_setting('r.lesson')::uuid,
  'abcdefghijk','Suggested clip',0,null)->>'id'),true);
select is(jsonb_array_length(public.get_lesson_v1(current_setting('r.lesson')::uuid)->'videos'),0,
  'pending video stays out of the student player');
select throws_ok($$select public.review_lesson_video_v1(current_setting('r.video')::uuid,'approved')$$,
  'PT403','FORBIDDEN','student cannot approve own video');
reset role;

select pg_temp.login(current_setting('r.admin')::uuid);
set local role authenticated;
select lives_ok($$select public.review_lesson_video_v1(current_setting('r.video')::uuid,'approved')$$,
  'independent reviewer can approve video');
select set_config('r.assignment',(public.create_light_assignment_v1(current_setting('r.offering')::uuid,
  'Read the first lesson',current_setting('r.lesson')::uuid,null,now()+interval '1 day')->>'id'),true);
select throws_ok($$select public.create_light_assignment_v1(current_setting('r.offering')::uuid,
  'Past deadline',current_setting('r.lesson')::uuid,null,now()-interval '1 day')$$,
  'PT422','VALIDATION_FAILED','past assignment deadline is rejected');
reset role;
select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select is(jsonb_array_length(public.get_lesson_v1(current_setting('r.lesson')::uuid)->'videos'),1,
  'approved video becomes visible');
select is(jsonb_array_length(public.list_light_assignments_v1(current_setting('r.offering')::uuid)->'items'),1,
  'student sees active course assignment');
select throws_ok($$select public.cancel_light_assignment_v1(current_setting('r.assignment')::uuid)$$,
  'PT403','FORBIDDEN','student cannot cancel assignment');
reset role;
select pg_temp.login(current_setting('r.admin')::uuid);
set local role authenticated;
select lives_ok($$select public.cancel_light_assignment_v1(current_setting('r.assignment')::uuid)$$,
  'reviewer can cancel assignment');
reset role;
select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select is(jsonb_array_length(public.list_light_assignments_v1(current_setting('r.offering')::uuid)->'items'),0,
  'cancelled assignment is hidden from student');
reset role;

-- Rejection history must not exhaust the 1..12 video position constraint.
update public.lesson_videos set status='rejected' where lesson_id=current_setting('r.lesson')::uuid;
insert into public.lesson_videos(lesson_id,youtube_id,title,position,status,submitted_by)
select current_setting('r.lesson')::uuid,'history'||lpad(i::text,4,'0'),'Rejected fixture',i,'rejected',
  current_setting('r.student')::uuid from generate_series(2,12) i;
select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select lives_ok($$select public.submit_lesson_video_v1(current_setting('r.lesson')::uuid,
  'newvideo123','New suggestion after rejections',0,null)$$,
  'rejected video history does not block new suggestions');
reset role;

-- Four paired learners are private; five are aggregated without learner identifiers.
do $$
declare uid uuid; i integer;
begin
  for i in 1..5 loop
    uid:=gen_random_uuid();
    perform set_config('r.learner'||i,uid::text,true);
    insert into auth.users(id,email,raw_user_meta_data)
      values(uid,uid||'@heatmap.test','{"display_name":"Heatmap fixture"}');
    insert into public.enrollments(user_id,offering_id)
      values(uid,current_setting('r.offering')::uuid);
    if i<=4 then
      insert into public.topic_check_attempts(user_id,course_code,topic_key,kind,score,total,answers)
      values(uid,'CYB101-FIXTURE','release-privacy','pre',1,5,'[]'),
            (uid,'CYB101-FIXTURE','release-privacy','post',4,5,'[]');
    end if;
  end loop;
end $$;
select pg_temp.login(current_setting('r.admin')::uuid);
set local role authenticated;
select is(jsonb_array_length(public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)->'rows'),0,
  'class with four paired learners is suppressed');
select is((public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)->>'suppressed_cells')::integer,1,
  'suppressed class is counted');
reset role;
insert into public.topic_check_attempts(user_id,course_code,topic_key,kind,score,total,answers)
values(current_setting('r.learner5')::uuid,'CYB101-FIXTURE','release-privacy','pre',1,5,'[]'),
      (current_setting('r.learner5')::uuid,'CYB101-FIXTURE','release-privacy','post',4,5,'[]');
set local role authenticated;
select is(jsonb_array_length(public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)->'rows'),1,
  'five paired learners produce one aggregate');
select is((public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)->'rows'->0->>'students')::integer,5,
  'aggregate contains five learners');
select ok(position(current_setting('r.learner1') in
  public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)::text)=0,
  'heatmap contains no learner identifier');
reset role;
update public.enrollments set ended_at=now()
where user_id=current_setting('r.learner5')::uuid and offering_id=current_setting('r.offering')::uuid;
set local role authenticated;
select is(jsonb_array_length(public.get_lecturer_topic_heatmap_v1(current_setting('r.offering')::uuid)->'rows'),0,
  'ended enrollment no longer contributes to the class threshold');
reset role;
-- Authored hints are confined to the owner's active untimed practice.
select set_config('r.attempt',gen_random_uuid()::text,true);
select set_config('r.question',(select qv.id::text from public.question_versions qv
  join public.questions q on q.id=qv.question_id where q.logical_key='L1-Q1' and qv.status='published'),true);
insert into public.assessment_attempts(id,user_id,offering_id,assessment_id,assessment_version_id,
  request_key,started_at,scoring_version,feedback_mode,total_count)
values(current_setting('r.attempt')::uuid,current_setting('r.student')::uuid,current_setting('r.offering')::uuid,
  '30000000-0000-4000-8000-000000000004','31000000-0000-4000-8000-000000000004',
  gen_random_uuid(),now(),1,'after_submit',1);
insert into public.attempt_questions(attempt_id,question_version_id,position,option_order)
select current_setting('r.attempt')::uuid,current_setting('r.question')::uuid,1,array_agg(id order by position)
from public.question_options where question_version_id=current_setting('r.question')::uuid;
select pg_temp.login(current_setting('r.admin')::uuid);
set local role authenticated;
select lives_ok($$select public.admin_set_practice_hints_v1(current_setting('r.question')::uuid,
  '["Think about which security goal protects unchanged data."]'::jsonb)$$,
  'administrator can author a practice hint');
reset role;
select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select is(public.get_practice_hint_v1(current_setting('r.attempt')::uuid,
  current_setting('r.question')::uuid,1)->>'hint','Think about which security goal protects unchanged data.',
  'owner receives approved hint during active untimed practice');
select throws_ok($$select public.get_practice_hint_v1(current_setting('r.attempt')::uuid,
  current_setting('r.question')::uuid,null)$$,'PT422','VALIDATION_FAILED','null hint step is rejected');
reset role;
select pg_temp.login(current_setting('r.outsider')::uuid);
set local role authenticated;
select throws_ok($$select public.get_practice_hint_v1(current_setting('r.attempt')::uuid,
  current_setting('r.question')::uuid,1)$$,'PT403','FORBIDDEN','another learner cannot read attempt hints');
reset role;
update public.assessment_attempts set expires_at=now()+interval '10 minutes'
where id=current_setting('r.attempt')::uuid;
select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select throws_ok($$select public.get_practice_hint_v1(current_setting('r.attempt')::uuid,
  current_setting('r.question')::uuid,1)$$,'PT403','FORBIDDEN','timed practice does not reveal hints');
reset role;
update public.assessment_attempts set expires_at=null,status='submitted',finalized_at=now()
where id=current_setting('r.attempt')::uuid;
set local role authenticated;
select throws_ok($$select public.get_practice_hint_v1(current_setting('r.attempt')::uuid,
  current_setting('r.question')::uuid,1)$$,'PT403','FORBIDDEN','finished practice cannot reveal hints');
reset role;

-- Private object access requires proof that this student uploaded the bytes.
select pg_temp.login(current_setting('r.student')::uuid);
set local role authenticated;
select throws_ok($$select public.submit_student_material_v1(current_setting('r.offering')::uuid,
 'source.pdf',repeat('a',64),'course-materials/'||repeat('a',64)||'.pdf','application/pdf',100,'')$$,
 'PT403','FORBIDDEN','student cannot claim a private object by supplying its hash');
select throws_ok($$select public.register_student_material_upload_v1(current_setting('r.student')::uuid,
 current_setting('r.offering')::uuid,repeat('a',64),'course-materials/'||repeat('a',64)||'.pdf','application/pdf',100)$$,
 '42501',null,'student cannot issue an upload receipt');
reset role;
set local role service_role;
select lives_ok($$select public.register_student_material_upload_v1(current_setting('r.student')::uuid,
 current_setting('r.offering')::uuid,repeat('a',64),'course-materials/'||repeat('a',64)||'.pdf','application/pdf',100)$$,
 'trusted upload server issues a receipt');
reset role;
set local role authenticated;
select set_config('r.material',(public.submit_student_material_v1(current_setting('r.offering')::uuid,
 'source.pdf',repeat('a',64),'course-materials/'||repeat('a',64)||'.pdf','application/pdf',100,'')->>'id'),true);
select is(public.get_student_material_source_v1(current_setting('r.material')::uuid)->>'filename',
 'source.pdf','uploader can retrieve the registered source');
select throws_ok($$select public.submit_student_material_v1(current_setting('r.offering')::uuid,
 'source.pdf',repeat('a',64),'course-materials/'||repeat('a',64)||'.pdf','application/pdf',100,'')$$,
 'PT403','FORBIDDEN','upload receipt is consumed once');
select throws_ok($$select public.review_student_material_v1(current_setting('r.material')::uuid,'approved','')$$,
 'PT403','FORBIDDEN','student cannot approve own material');
reset role;
select pg_temp.login(current_setting('r.outsider')::uuid);
set local role authenticated;
select throws_ok($$select public.get_student_material_source_v1(current_setting('r.material')::uuid)$$,
 'PT403','FORBIDDEN','another learner cannot download the private source');
reset role;
select pg_temp.login(current_setting('r.admin')::uuid);
set local role authenticated;
select lives_ok($$select public.review_student_material_v1(current_setting('r.material')::uuid,'rejected','Wrong course')$$,
 'reviewer can reject a source without queuing ingestion');
reset role;
select is((select ingestion_job_id from private.student_material_submissions
 where id=current_setting('r.material')::uuid),null::uuid,'rejection never creates an ingestion job');

select * from finish();
rollback;
