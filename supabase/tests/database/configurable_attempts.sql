-- Execute in a transaction and ROLLBACK. Uses an enrolled administrator and temporary assessments.
do $$
declare actor uuid; course uuid; source uuid; questions uuid[]; created jsonb; vid uuid; practice_vid uuid;
 payload jsonb; replay jsonb; key uuid:=gen_random_uuid(); deadline timestamptz; attempt uuid; rejected boolean;
begin
 select e.user_id,a.course_id,av.id into strict actor,course,source
 from public.enrollments e join public.course_offerings o on o.id=e.offering_id
 join public.user_roles r on r.user_id=e.user_id and r.role='admin'
 join public.assessments a on a.course_id=o.course_id and a.kind='mock'
 join public.assessment_versions av on av.assessment_id=a.id and av.status='published' and av.question_count>=5
 join public.profiles p on p.id=e.user_id and p.deactivated_at is null
 where e.ended_at is null order by a.created_at limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.headers','{"x-client-platform":"web","x-client-build":"999999","x-api-version":"1"}',true);
 select array_agg(qid) into questions from (select aq.question_version_id qid from public.assessment_questions aq join public.question_versions qv on qv.id=aq.question_version_id and qv.status='published' where aq.assessment_version_id=source limit 5) q;
 if cardinality(questions)<>5 then raise exception 'Need five published question fixtures'; end if;
 created:=public.admin_upsert_assessment_draft_v1(null,course,'mock','Transactional custom mock test',null,5,600,questions,gen_random_uuid());
 vid:=(created->>'assessment_version_id')::uuid;
 perform public.admin_publish_v1('assessment_version',vid,gen_random_uuid());
 payload:=public.start_configured_attempt_v1(vid,key,3,1800,true);
 attempt:=(payload->>'attempt_id')::uuid; deadline:=(payload->>'expires_at')::timestamptz;
 if (payload->>'total_count')::integer<>3 or jsonb_array_length(payload->'questions')<>3 then raise exception 'Configured count not used'; end if;
 if deadline-(payload->>'started_at')::timestamptz<>interval '30 minutes' then raise exception 'Configured timer not used'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'questions') q where q->'feedback'<>'null'::jsonb) then raise exception 'Answer keys exposed before submission'; end if;
 replay:=public.start_configured_attempt_v1(vid,key,2,60,true);
 if replay->>'attempt_id'<>attempt::text or (replay->>'expires_at')::timestamptz<>deadline or (replay->>'total_count')::integer<>3 then raise exception 'Retry changed an existing session'; end if;
 replay:=public.start_configured_attempt_v1(vid,gen_random_uuid(),1,120,true);
 if replay->>'attempt_id'<>attempt::text or (replay->>'expires_at')::timestamptz<>deadline then raise exception 'Resume reset the timer'; end if;
 if (select question_count from public.assessment_versions where id=vid)<>5 or (select duration_seconds from public.assessment_versions where id=vid)<>600 then raise exception 'Shared assessment was modified'; end if;
 rejected:=false; begin perform public.start_configured_attempt_v1(vid,gen_random_uuid(),6,1800,true); exception when sqlstate 'PT422' then rejected:=true; end;
 if not rejected then raise exception 'Out-of-bank question count accepted'; end if;
 rejected:=false; begin perform public.start_configured_attempt_v1(vid,gen_random_uuid(),2,0,true); exception when sqlstate 'PT422' then rejected:=true; end;
 if not rejected then raise exception 'Zero duration accepted'; end if;
 rejected:=false; begin perform public.start_configured_attempt_v1(vid,gen_random_uuid(),2,1800,false); exception when sqlstate 'PT409' then rejected:=true; end;
 if not rejected then raise exception 'Concurrent attempt protection lost'; end if;
 created:=public.admin_upsert_assessment_draft_v1(null,course,'practice','Transactional untimed practice test',null,5,null,questions,gen_random_uuid());
 practice_vid:=(created->>'assessment_version_id')::uuid;
 perform public.admin_publish_v1('assessment_version',practice_vid,gen_random_uuid());
 payload:=public.start_configured_attempt_v1(practice_vid,gen_random_uuid(),2,null,true);
 if (payload->>'total_count')::integer<>2 or payload->>'expires_at' is not null then raise exception 'Untimed practice configuration failed'; end if;
 if has_function_privilege('anon','public.start_configured_attempt_v1(uuid,uuid,integer,integer,boolean)','execute') then raise exception 'Anonymous attempt start allowed'; end if;
end $$;
