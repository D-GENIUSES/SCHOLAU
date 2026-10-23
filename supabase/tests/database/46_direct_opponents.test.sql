create extension if not exists pgtap with schema extensions;
begin;
select no_plan();
create function pg_temp.social_login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',p_uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_uid,'role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
end;
$$;
select set_config('t.a','90000000-0000-4000-8000-000000000001',true);
select set_config('t.b','90000000-0000-4000-8000-000000000002',true);
select set_config('t.course2',gen_random_uuid()::text,true);
select set_config('t.course3',gen_random_uuid()::text,true);
select set_config('t.off2',gen_random_uuid()::text,true);
select set_config('t.off3',gen_random_uuid()::text,true);
insert into public.courses(id,code,title) values(current_setting('t.course2')::uuid,'SOCIAL_MATH','Local test mathematics'),(current_setting('t.course3')::uuid,'SOCIAL_PHYS','Local test physics');
insert into public.course_offerings(id,course_id,university_id,department_id,level_id,semester_id,status)
select x.id,x.course_id,o.university_id,o.department_id,o.level_id,o.semester_id,'published'
from public.course_offerings o cross join (values(current_setting('t.off2')::uuid,current_setting('t.course2')::uuid),(current_setting('t.off3')::uuid,current_setting('t.course3')::uuid))x(id,course_id)
where o.id='20000000-0000-4000-8000-000000000002';
insert into public.enrollments(user_id,offering_id) select u,o from unnest(array[current_setting('t.a')::uuid,current_setting('t.b')::uuid])u cross join unnest(array[current_setting('t.off2')::uuid,current_setting('t.off3')::uuid])o on conflict do nothing;
-- Put the second student in another department's offer for the same course.
select set_config('t.alt_off2',gen_random_uuid()::text,true);
insert into public.course_offerings(id,course_id,university_id,department_id,level_id,semester_id,status)
select current_setting('t.alt_off2')::uuid,o.course_id,o.university_id,
  (select d.id from public.departments d where d.university_id=o.university_id and d.id<>o.department_id limit 1),
  o.level_id,o.semester_id,'published'
from public.course_offerings o where o.id=current_setting('t.off2')::uuid
  and exists(select 1 from public.departments d where d.university_id=o.university_id and d.id<>o.department_id);
update public.enrollments set offering_id=current_setting('t.alt_off2')::uuid
where user_id=current_setting('t.b')::uuid and offering_id=current_setting('t.off2')::uuid
  and exists(select 1 from public.course_offerings where id=current_setting('t.alt_off2')::uuid);
-- The invited learner has a shared department course, but has not started any lessons.
delete from public.enrollments where user_id=current_setting('t.b')::uuid and offering_id=current_setting('t.off3')::uuid;

select ok(not has_function_privilege('anon','public.get_friends_v1()','execute'),'Guests cannot access friends');
select ok(not has_function_privilege('anon','public.create_scoped_battle_v1(uuid[],integer,uuid,uuid)','execute'),'Guests cannot create scoped battles');
select ok(not has_table_privilege('authenticated','public.friendships','insert'),'Clients cannot forge friendships');
select ok(not has_function_privilege('authenticated','private.battle_question_seconds(uuid)','execute'),'Timing helper remains private');
select pg_temp.social_login(current_setting('t.a')::uuid);
select is(public.set_friend_username_v1('Battler_A')->>'username','battler_a','Usernames normalize to lowercase');
select throws_ok($$select public.set_friend_username_v1('bad name!')$$,'PT422',null,'Invalid usernames rejected');
select is(jsonb_array_length(public.search_friends_v1('ba')->'people'),0,'Short searches return no users');
select throws_ok($$select public.friend_action_v1(current_setting('t.a')::uuid,'request')$$,'PT422',null,'Cannot add yourself');
select public.friend_action_v1(current_setting('t.b')::uuid,'request');
select is((public.get_friends_v1()->'people'->0->>'state'),'pending','Request is pending');
select throws_ok($$select public.friend_action_v1(current_setting('t.b')::uuid,'accept')$$,'PT403',null,'Sender cannot accept their own request');
reset role;
select pg_temp.social_login(current_setting('t.b')::uuid);
select throws_ok($$select public.set_friend_username_v1('battler_a')$$,'PT422',null,'Usernames are unique');
select is((public.get_friends_v1()->'people'->0->>'incoming'),'true','Recipient sees incoming request');
select public.friend_action_v1(current_setting('t.a')::uuid,'accept');
select is((public.friend_action_v1(current_setting('t.a')::uuid,'accept')->'people'->0->>'state'),'accepted','Acceptance is retry-safe');
select is(jsonb_array_length(public.get_battle_setup_v1(current_setting('t.b')::uuid)->'courses'),3,'Setup shows all shared courses across different departments');
reset role;
select pg_temp.social_login(current_setting('t.a')::uuid);
select throws_ok($$select public.create_scoped_battle_v1(array[current_setting('t.off2')::uuid],5,gen_random_uuid(),current_setting('t.b')::uuid)$$,'PT404',null,'Empty course bank blocks creation');
select throws_ok($$select public.create_scoped_battle_v1(array[current_setting('t.off2')::uuid],31,gen_random_uuid())$$,'PT422',null,'Thirty-question maximum enforced');
select throws_ok($$select public.create_scoped_battle_v1(array[current_setting('t.off2')::uuid,current_setting('t.off2')::uuid],5,gen_random_uuid())$$,'PT422',null,'Duplicate courses rejected');
select throws_ok($$select public.create_scoped_battle_v1(array[current_setting('t.off2')::uuid,current_setting('t.off3')::uuid,'20000000-0000-4000-8000-000000000002'::uuid,gen_random_uuid()],5,gen_random_uuid())$$,'PT422',null,'Three-course maximum enforced');
reset role;

-- Local-only question bank. Publishing exercises the same validation used by imports.
create function pg_temp.social_seed(p_course uuid) returns void language plpgsql as $$
declare q uuid; v uuid; opt uuid; answer uuid; n integer; i integer;
begin
  for n in 1..6 loop
    insert into public.questions(course_id,pool,logical_key) values(p_course,'battle','social-local-'||n) returning id into q;
    insert into public.question_versions(question_id,version,prompt,difficulty,usage,source_reference,answer_format,battle_seconds)
      values(q,1,'Solve 2x + 6 = 18. Choose the correct working.','beginner',array['battle'],'Local test only','worked_solution',(array[10,12,15])[1+n%3]) returning id into v;
    for i in 1..4 loop
      insert into public.question_options(question_version_id,label,body,position,steps) values(v,chr(64+i),(array['x = 6','x = 3','x = 12','x = 15'])[i],i,array[(array['2x = 18 − 6','x = 18 ÷ 2 − 6','2x = 18 + 6','x = 18 − 6 ÷ 2'])[i]]) returning id into opt;
      if i=1 then answer:=opt; end if;
    end loop;
    insert into private.question_answer_keys values(v,answer,'Subtract 6, then divide by 2.');
    perform private.publish_question_version(v,'90000000-0000-4000-8000-000000000002');
  end loop;
end;
$$;
select pg_temp.social_seed(current_setting('t.course2')::uuid);
select pg_temp.social_seed(current_setting('t.course3')::uuid);
select pg_temp.social_login(current_setting('t.a')::uuid);
-- Nonfriends can challenge each other; identity editing is unrelated to battle creation.
select public.friend_action_v1(current_setting('t.b')::uuid,'remove');
select is(jsonb_array_length(public.get_battle_setup_v1(current_setting('t.a')::uuid)->'courses'),3,'Opponent sees common courses across departments');
select throws_ok($$select public.get_battle_setup_v1(current_setting('t.a')::uuid)$$,'PT403',null,'Self challenge is rejected');
select public.friend_action_v1(current_setting('t.b')::uuid,'block');
select throws_ok($$select public.get_battle_setup_v1(current_setting('t.b')::uuid)$$,'PT403',null,'Blocked opponent setup is rejected');
select throws_ok($$select public.create_scoped_battle_v1(array[current_setting('t.off2')::uuid],5,gen_random_uuid(),current_setting('t.b')::uuid)$$,'PT403',null,'Blocked direct invitation rejected');
select public.friend_action_v1(current_setting('t.b')::uuid,'unblock');
select set_config('t.key',gen_random_uuid()::text,true);
select set_config('t.invite',public.create_scoped_battle_v1(array['20000000-0000-4000-8000-000000000002'::uuid,current_setting('t.off2')::uuid],6,current_setting('t.key')::uuid,current_setting('t.b')::uuid)::text,true);
select set_config('t.battle',current_setting('t.invite')::jsonb->>'battle_id',true);
select is(jsonb_array_length(current_setting('t.invite')::jsonb->'courses'),2,'Invitation snapshots two common courses');
select is(public.create_scoped_battle_v1(array['20000000-0000-4000-8000-000000000002'::uuid,current_setting('t.off2')::uuid],6,current_setting('t.key')::uuid,current_setting('t.b')::uuid)->>'battle_id',current_setting('t.battle'),'Creation retry returns same invitation');
reset role;
select pg_temp.social_login(current_setting('t.b')::uuid);
select is(jsonb_array_length(public.get_battle_invitations_v1()->'invitations'),1,'Friend receives directed invitation');
select is((public.get_battle_invite_preview_v1(current_setting('t.invite')::jsonb->>'invite_token')->>'round_count')::integer,6,'Preview shows count before acceptance');
select public.friend_action_v1(current_setting('t.a')::uuid,'block');
select is(jsonb_array_length(public.get_battle_invitations_v1()->'invitations'),0,'Blocking creator hides pending invitations');
select throws_ok($$select public.get_battle_invite_preview_v1(current_setting('t.invite')::jsonb->>'invite_token')$$,'PT403',null,'Blocking creator prevents invitation preview');
select throws_ok($$select public.accept_battle_v1(current_setting('t.invite')::jsonb->>'invite_token',gen_random_uuid())$$,'PT403',null,'Blocking creator prevents acceptance');
select public.friend_action_v1(current_setting('t.a')::uuid,'unblock');
select public.accept_battle_v1(current_setting('t.invite')::jsonb->>'invite_token',gen_random_uuid());
select is((select state from public.battles where id=current_setting('t.battle')::uuid),'ready','Learner accepts shared-course battle using another department offer without starting lessons');
select public.ready_battle_v1(current_setting('t.battle')::uuid,gen_random_uuid());
reset role;
select pg_temp.social_login(current_setting('t.a')::uuid);
select set_config('t.scheduled',public.ready_battle_v1(current_setting('t.battle')::uuid,gen_random_uuid())::text,true);
select is(current_setting('t.scheduled')::jsonb->>'state','countdown','Both ready schedules scoped match');
select ok(current_setting('t.scheduled')::jsonb->'current_question'='null'::jsonb,'Future prompts stay hidden');
reset role;
select is((select count(*)::integer from public.battle_questions where battle_id=current_setting('t.battle')::uuid),9,'Requested total is scheduled');
select is((select count(*)::integer from (select q.course_id,count(*) from public.battle_questions bq join public.question_versions v on v.id=bq.question_version_id join public.questions q on q.id=v.question_id where bq.battle_id=current_setting('t.battle')::uuid group by q.course_id having count(*)=3)x),3,'Question split is balanced across courses');
select ok((select bool_and(extract(epoch from(deadline-opened_at)) in(5,8,10,12,15)) from public.battle_questions where battle_id=current_setting('t.battle')::uuid),'Each question has approved duration');
select ok((select bool_and(reading_at=prior_deadline) from (select reading_at,lag(deadline) over(order by position) prior_deadline from public.battle_questions where battle_id=current_setting('t.battle')::uuid)x where prior_deadline is not null),'Variable-duration rounds are contiguous');
select is((select extract(epoch from(b.ends_at-b.starts_at))::integer from public.battles b where id=current_setting('t.battle')::uuid),(select sum(extract(epoch from(deadline-reading_at)))::integer from public.battle_questions where battle_id=current_setting('t.battle')::uuid),'Battle end is the sum of actual question durations');
select set_config('t.read_shift',(select (reading_at-now()+interval '1 second')::text from public.battle_questions where battle_id=current_setting('t.battle')::uuid and position=1),true);
update public.battles set starts_at=starts_at-current_setting('t.read_shift')::interval,ends_at=ends_at-current_setting('t.read_shift')::interval where id=current_setting('t.battle')::uuid;
update public.battle_questions set reading_at=reading_at-current_setting('t.read_shift')::interval,opened_at=opened_at-current_setting('t.read_shift')::interval,deadline=deadline-current_setting('t.read_shift')::interval where battle_id=current_setting('t.battle')::uuid;
select set_config('t.first_option',(select option_order[1]::text from public.battle_questions where battle_id=current_setting('t.battle')::uuid and position=1),true);
select pg_temp.social_login(current_setting('t.a')::uuid);
select ok((public.get_battle_state_v1(current_setting('t.battle')::uuid)->'current_question'->>'prompt') is not null,'Question and options are visible during reading time');
select throws_ok($$select public.submit_battle_answer_v1(current_setting('t.battle')::uuid,1,current_setting('t.first_option')::uuid,gen_random_uuid())$$,'PT409','INVALID_STATE','Server rejects answers during the reading phase');
reset role;
update public.battles set starts_at=starts_at-interval '6 seconds',ends_at=ends_at-interval '6 seconds' where id=current_setting('t.battle')::uuid;
update public.battle_questions set reading_at=reading_at-interval '6 seconds',opened_at=opened_at-interval '6 seconds',deadline=deadline-interval '6 seconds' where battle_id=current_setting('t.battle')::uuid;
select pg_temp.social_login(current_setting('t.a')::uuid);
select set_config('t.state_a',public.get_battle_state_v1(current_setting('t.battle')::uuid)::text,true);
reset role;
select pg_temp.social_login(current_setting('t.b')::uuid);
select set_config('t.state_b',public.get_battle_state_v1(current_setting('t.battle')::uuid)::text,true);
select is(current_setting('t.state_a')::jsonb#>>'{current_question,prompt}',current_setting('t.state_b')::jsonb#>>'{current_question,prompt}','Players see identical prompt');
select is(current_setting('t.state_a')::jsonb#>>'{current_question,deadline}',current_setting('t.state_b')::jsonb#>>'{current_question,deadline}','Players share exact server deadline');
select ok(not(current_setting('t.state_a') like '%correct_option_id%'),'No answer keys in participant payload');
reset role;
select private.cancel_battle(current_setting('t.battle')::uuid,'pre_start_cancel');
select pg_temp.social_login(current_setting('t.a')::uuid);
select public.friend_action_v1(current_setting('t.b')::uuid,'block');
select is(jsonb_array_length(public.search_friends_v1('battler')->'people'),0,'Blocked user hidden from search');
reset role;
select pg_temp.social_login(current_setting('t.b')::uuid);
select throws_ok($$select public.friend_action_v1(current_setting('t.a')::uuid,'request')$$,'PT403',null,'Block prevents new requests');
select throws_ok($$select public.create_scoped_battle_v1(array['20000000-0000-4000-8000-000000000002'::uuid],5,gen_random_uuid(),current_setting('t.a')::uuid)$$,'PT403',null,'Block prevents directed invitations');
reset role;
-- Import validation keeps worked solutions usable in the authoring workflow.
select pg_temp.social_login(current_setting('t.b')::uuid);
select set_config('t.import',jsonb_build_array(jsonb_build_object(
  'course_code','SOCIAL_MATH','logical_question_key','import-worked-001','pool','battle','usage',jsonb_build_array('battle'),
  'difficulty','beginner','prompt','Solve 2x + 6 = 18.','answer_format','worked_solution','battle_seconds',15,
  'options',jsonb_build_array(
    jsonb_build_object('label','A','body','x = 6','steps',jsonb_build_array('2x = 12','x = 12 / 2')),
    jsonb_build_object('label','B','body','x = 3','steps',jsonb_build_array('x = 18 / 2 - 6')),
    jsonb_build_object('label','C','body','x = 12','steps',jsonb_build_array('2x = 18 + 6')),
    jsonb_build_object('label','D','body','x = 15','steps',jsonb_build_array('x = 18 - 6 / 2'))),
  'correct_option','A','explanation','Subtract 6 and divide by 2.','source_reference','Local test source'))::text,true);
select is(public.admin_import_questions_v1(current_setting('t.import')::jsonb,true)->>'valid','true','Worked-solution import validates');
select is(public.admin_import_questions_v1(jsonb_set(current_setting('t.import')::jsonb,'{0,battle_seconds}','9'),true)->>'valid','false','Unsupported times rejected in dry run');
select is(public.admin_import_questions_v1(jsonb_set(current_setting('t.import')::jsonb,'{0,options,0,steps}','[]'),true)->>'valid','false','Worked option requires calculation steps');
select is(public.admin_import_questions_v1(jsonb_set(current_setting('t.import')::jsonb,'{0,options,0,steps}','"invalid"'),true)->>'valid','false','Non-array steps rejected without crashing');
select set_config('t.imported',public.admin_import_questions_v1(current_setting('t.import')::jsonb,false,gen_random_uuid())::text,true);
select set_config('t.version',current_setting('t.imported')::jsonb#>>'{created,0,question_version_id}',true);
select is(public.admin_get_question_v1(current_setting('t.version')::uuid)->>'answer_format','worked_solution','Review reads the imported format');
select is((public.admin_get_question_v1(current_setting('t.version')::uuid)->>'battle_seconds')::integer,15,'Review reads the author timing');
select is(jsonb_array_length(public.admin_get_question_v1(current_setting('t.version')::uuid)#>'{options,0,steps}'),2,'Review reads imported calculation steps');
reset role;
select private.publish_question_version(current_setting('t.version')::uuid,current_setting('t.b')::uuid);
select is(private.battle_question_seconds(current_setting('t.version')::uuid),15,'Scheduling respects reviewer time override');
select ok(exists(select 1 from private.outbox where event='friends_changed' and topic='user:'||current_setting('t.a')),'Friend changes enqueue a private user signal');
select ok(exists(select 1 from private.outbox where event='battle_invitation' and topic='user:'||current_setting('t.b')),'Invitation enqueues a private user signal');
select finish();
rollback;

