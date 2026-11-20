alter table private.course_challenges drop constraint if exists course_challenges_questions_check;
alter table private.course_challenges add constraint course_challenges_questions_check check (jsonb_typeof(questions)='array' and jsonb_array_length(questions)<=200);
create or replace function private.challenge_teacher(p_offering uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles r where r.user_id=p_user and r.role='admin') or exists(select 1 from public.lecturer_course_assignments a join public.user_roles r on r.user_id=a.user_id and r.role='lecturer' join public.profiles p on p.id=a.user_id and p.deactivated_at is null join auth.users u on u.id=p.id and u.email_confirmed_at is not null where a.offering_id=p_offering and a.user_id=p_user)
$$;

create or replace function public.save_course_challenge_v1(p_id uuid,p_offering_id uuid,p_revision integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; questions jsonb:='[]'; q jsonb; v jsonb; source uuid;
begin
 if not private.challenge_teacher(p_offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if not exists(select 1 from public.course_offerings where id=p_offering_id and status='published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 if p_id is null or coalesce(length(btrim(p_data->>'title')),0) not between 1 and 160 or coalesce(length(p_data->>'instructions'),0)>4000 or coalesce(p_data->>'duration_minutes','')!~ '^\d{1,3}$' or (p_data->>'duration_minutes')::int not between 1 and 180 or jsonb_typeof(p_data->'questions') is distinct from 'array' then perform private.raise_error('VALIDATION_FAILED'); end if;
 if jsonb_array_length(p_data->'questions')>200 then perform private.raise_error('VALIDATION_FAILED'); end if;
 perform pg_advisory_xact_lock(hashtextextended('course-challenge:'||p_id::text,0));
 select * into c from private.course_challenges where id=p_id for update;
 if found then if c.offering_id<>p_offering_id or c.status<>'draft' or c.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if; elsif p_revision is distinct from 0 then perform private.raise_error('STALE_REVISION'); end if;
 for q in select value from jsonb_array_elements(p_data->'questions') loop
  source:=nullif(q->>'source_version_id','')::uuid;
  if source is not null then select jsonb_build_object('source_version_id',v.id,'prompt',v.prompt,'options',(select jsonb_agg(o.body order by o.position,o.id) from public.question_options o where o.question_version_id=v.id),'correct',(select count(*)::int from public.question_options o join public.question_options correct on correct.id=k.correct_option_id where o.question_version_id=v.id and (o.position,o.id)<(correct.position,correct.id)),'explanation',k.explanation) into v from public.question_versions v join public.questions x on x.id=v.question_id join private.question_answer_keys k on k.question_version_id=v.id join public.course_offerings co on co.course_id=x.course_id where co.id=p_offering_id and v.id=source and v.status='published' and v.answer_format='standard'; if v is null then perform private.raise_error('VALIDATION_FAILED'); end if; q:=v; end if;
  if coalesce(length(btrim(q->>'prompt')),0) not between 1 and 2000 or jsonb_typeof(q->'options') is distinct from 'array' or coalesce(q->>'correct','')!~ '^[0-3]$' or jsonb_array_length(q->'options')<>4 then perform private.raise_error('VALIDATION_FAILED','Complete the question and its answer key.'); end if;
  questions:=questions||jsonb_build_array(jsonb_build_object('source_version_id',source,'prompt',btrim(q->>'prompt'),'options',q->'options','correct',(q->>'correct')::int,'explanation',coalesce(q->>'explanation','')));
 end loop;
 insert into private.course_challenges(id,offering_id,created_by,title,instructions,duration_minutes,questions,starts_at) values(p_id,p_offering_id,u,btrim(p_data->>'title'),coalesce(p_data->>'instructions',''),(p_data->>'duration_minutes')::int,questions,nullif(p_data->>'starts_at','')::timestamptz) on conflict(id) do update set title=excluded.title,instructions=excluded.instructions,duration_minutes=excluded.duration_minutes,questions=excluded.questions,starts_at=excluded.starts_at,revision=private.course_challenges.revision+1 returning * into c;
 return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c),'questions',c.questions));
end $$;

alter table private.lecturer_course_quizzes drop constraint if exists lecturer_course_quizzes_questions_check;
alter table private.lecturer_course_quizzes add constraint lecturer_course_quizzes_questions_check check (jsonb_typeof(questions)='array' and jsonb_array_length(questions)<=200);
create or replace function private.quiz_normalize_questions(p_data jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare v_questions jsonb := '[]'::jsonb; q jsonb; v_type text;
begin
 if jsonb_typeof(p_data->'questions') is distinct from 'array' or jsonb_array_length(p_data->'questions')>200 then perform private.raise_error('VALIDATION_FAILED'); end if;
 for q in select value from jsonb_array_elements(p_data->'questions') loop
  v_type:=coalesce(q->>'type','mcq'); perform private.quiz_validate_question(q);
  if v_type='mcq' then v_questions:=v_questions||jsonb_build_array(jsonb_build_object('type','mcq','prompt',btrim(q->>'prompt'),'options',q->'options','correct',(q->>'correct')::int,'explanation',coalesce(q->>'explanation','')));
  else v_questions:=v_questions||jsonb_build_array(jsonb_build_object('type',v_type,'prompt',btrim(q->>'prompt'),'expected_answer',btrim(q->>'expected_answer'),'explanation',coalesce(q->>'explanation',''))); end if;
 end loop; return v_questions;
end; $$;

create or replace function public.publish_lecturer_quiz_v1(p_id uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); q private.lecturer_course_quizzes;
begin
 select * into q from private.lecturer_course_quizzes where id=p_id for update;
 if not found or not private.challenge_teacher(q.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if q.status='published' then return private.envelope(jsonb_build_object('quiz',private.quiz_summary(q))); end if;
 if q.status<>'draft' then perform private.raise_error('INVALID_STATE'); end if;
 if q.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
 if jsonb_array_length(q.questions) not between 1 and 200 then perform private.raise_error('VALIDATION_FAILED','Add at least one question.'); end if;
 if q.opens_at is null or q.closes_at is null or q.closes_at<=q.opens_at or q.closes_at<=clock_timestamp() then perform private.raise_error('VALIDATION_FAILED','Set a future quiz window.'); end if;
 if not exists(select 1 from public.course_offerings where id=q.offering_id and status='published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 update private.lecturer_course_quizzes set status='published',revision=revision+1 where id=p_id returning * into q;
 insert into public.notifications(user_id,kind,body,safe_target,event_key) select e.user_id,'course_quiz','New course quiz: '||q.title,'/course-quizzes/'||q.id::text,'course-quiz:'||q.id::text||':'||e.user_id::text from public.enrollments e where e.offering_id=q.offering_id and e.ended_at is null and private.challenge_student(q.offering_id,e.user_id) on conflict(event_key) do nothing;
 perform private.audit(u,'publish_lecturer_quiz','lecturer_quiz',q.id,null); return private.envelope(jsonb_build_object('quiz',private.quiz_summary(q)));
end; $$;

create or replace function public.publish_course_challenge_v1(p_id uuid,p_revision integer,p_starts_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; start_time timestamptz;
begin
 select * into c from private.course_challenges where id=p_id for update;
 if not found or not private.challenge_teacher(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if c.status='published' then return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c))); end if;
 if c.status<>'draft' or c.revision is distinct from p_revision or jsonb_array_length(c.questions) not between 1 and 200 then perform private.raise_error('VALIDATION_FAILED','Add at least one question.'); end if;
 if not exists(select 1 from public.course_offerings where id=c.offering_id and status='published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 start_time:=coalesce(p_starts_at,clock_timestamp()); if p_starts_at is not null and p_starts_at<clock_timestamp() then perform private.raise_error('VALIDATION_FAILED','Choose a future start time.'); end if;
 update private.course_challenges set status='published',starts_at=start_time,ends_at=start_time+make_interval(mins=>duration_minutes),revision=revision+1 where id=p_id returning * into c;
 insert into public.notifications(user_id,kind,body,safe_target,event_key) select e.user_id,'course_challenge','New course challenge: '||c.title,'/challenges/'||c.id::text,'course-challenge:'||c.id::text||':'||e.user_id::text from public.enrollments e where e.offering_id=c.offering_id and e.ended_at is null and private.challenge_student(c.offering_id,e.user_id) on conflict(event_key) do nothing;
 perform private.audit(u,'publish_course_challenge','course_challenge',c.id,null); return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c)));
end $$;
