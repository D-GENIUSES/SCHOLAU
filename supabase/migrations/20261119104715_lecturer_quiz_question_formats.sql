-- Add typed quiz questions and persist written/dictated responses for lecturer review.

create or replace function private.quiz_score(p_questions jsonb, p_answers jsonb) returns integer
language sql immutable set search_path = '' as $$
  select count(*)::integer
  from jsonb_array_elements(p_questions) with ordinality q(v,n)
  where case coalesce(q.v->>'type','mcq')
    when 'mcq' then p_answers->>(n-1)::text = q.v->>'correct'
    when 'fill_blank' then lower(btrim(coalesce(p_answers->>(n-1)::text,''))) = lower(btrim(q.v->>'expected_answer'))
    when 'written' then coalesce((p_answers->((n-1)::text)->>'score')::integer,0) = 1
    when 'oral' then coalesce((p_answers->((n-1)::text)->>'score')::integer,0) = 1
    else false
  end
$$;

create or replace function private.quiz_build_shuffle(p_questions jsonb, p_seed text)
returns table(question_order integer[], option_orders jsonb)
language plpgsql immutable set search_path = '' as $$
declare n integer := jsonb_array_length(p_questions); qo integer[]; oo jsonb := '[]'::jsonb; i integer; opts integer[];
begin
  qo := array(select s - 1 from generate_series(1,n) s order by md5(p_seed || ':q:' || (s-1)::text));
  for i in 0..(n-1) loop
    opts := array(select s - 1 from generate_series(1,coalesce(jsonb_array_length(p_questions->i->'options'),0)) s order by md5(p_seed || ':o:' || i::text || ':' || (s-1)::text));
    oo := oo || to_jsonb(opts);
  end loop;
  question_order := qo; option_orders := oo; return next;
end;
$$;

create or replace function private.quiz_validate_question(q jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_type text := coalesce(q->>'type','mcq'); n integer; max_answer_length integer;
begin
  if coalesce(length(btrim(q->>'prompt')),0) not between 1 and 2000 then
    perform private.raise_error('VALIDATION_FAILED','Complete each question prompt.');
  end if;
  if v_type = 'mcq' then
    if jsonb_typeof(q->'options') is distinct from 'array' then perform private.raise_error('VALIDATION_FAILED','Each multiple-choice question needs options.'); end if;
    n := jsonb_array_length(q->'options');
    if n not between 2 and 6 then perform private.raise_error('VALIDATION_FAILED','Use between 2 and 6 options per multiple-choice question.'); end if;
    if coalesce(q->>'correct','') !~ '^\d+$' or (q->>'correct')::int < 0 or (q->>'correct')::int >= n then perform private.raise_error('VALIDATION_FAILED','Mark the correct option for each question.'); end if;
    if exists(select 1 from jsonb_array_elements(q->'options') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 1 and 1000) then perform private.raise_error('VALIDATION_FAILED','Option text is required.'); end if;
    if (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(q->'options') x) <> n then perform private.raise_error('VALIDATION_FAILED','Options must be distinct.'); end if;
  elsif v_type in ('written','fill_blank','oral') then
    max_answer_length := case when v_type='fill_blank' then 1000 else 4000 end;
    if jsonb_typeof(q->'expected_answer') is distinct from 'string'
      or coalesce(length(btrim(q->>'expected_answer')),0) not between 1 and max_answer_length then
      perform private.raise_error('VALIDATION_FAILED','Add a model answer for each written, fill-in-the-blank, and oral question.');
    end if;
  else
    perform private.raise_error('VALIDATION_FAILED','Choose a supported question type.');
  end if;
  if coalesce(length(q->>'explanation'),0)>4000 then perform private.raise_error('VALIDATION_FAILED'); end if;
end;
$$;

create or replace function private.quiz_normalize_questions(p_data jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare v_questions jsonb := '[]'::jsonb; q jsonb; v_type text;
begin
  if jsonb_typeof(p_data->'questions') is distinct from 'array' or jsonb_array_length(p_data->'questions')>100 then perform private.raise_error('VALIDATION_FAILED'); end if;
  for q in select value from jsonb_array_elements(p_data->'questions') loop
    v_type := coalesce(q->>'type','mcq');
    perform private.quiz_validate_question(q);
    if v_type='mcq' then
      v_questions := v_questions || jsonb_build_array(jsonb_build_object('type','mcq','prompt',btrim(q->>'prompt'),'options',q->'options','correct',(q->>'correct')::int,'explanation',coalesce(q->>'explanation','')));
    else
      v_questions := v_questions || jsonb_build_array(jsonb_build_object('type',v_type,'prompt',btrim(q->>'prompt'),'expected_answer',btrim(q->>'expected_answer'),'explanation',coalesce(q->>'explanation','')));
    end if;
  end loop;
  return v_questions;
end;
$$;

create or replace function private.quiz_student_questions(p_questions jsonb,p_question_order integer[],p_option_orders jsonb,p_reveal boolean)
returns jsonb language plpgsql stable set search_path = '' as $$
declare out jsonb:='[]'::jsonb; i integer; cq integer; q jsonb; opts jsonb; perm jsonb; j integer; idx integer; item jsonb; v_type text;
begin
  for i in 0..(coalesce(array_length(p_question_order,1),0)-1) loop
    cq:=p_question_order[i+1]; q:=p_questions->cq; v_type:=coalesce(q->>'type','mcq'); perm:=p_option_orders->i; opts:='[]'::jsonb;
    if v_type='mcq' then
      for j in 0..(coalesce(jsonb_array_length(perm),0)-1) loop idx:=(perm->>j)::int; opts:=opts||jsonb_build_array(q->'options'->idx); end loop;
      item:=jsonb_build_object('type','mcq','prompt',q->>'prompt','options',opts);
      if p_reveal then
        item:=item||jsonb_build_object('correct',coalesce((select pos-1 from jsonb_array_elements(perm) with ordinality p(v,pos) where (v#>>'{}')::int=(q->>'correct')::int limit 1),0),'explanation',q->>'explanation');
      end if;
    else
      item:=jsonb_build_object('type',v_type,'prompt',q->>'prompt');
      if p_reveal then item:=item||jsonb_build_object('expected_answer',q->>'expected_answer','explanation',q->>'explanation'); end if;
    end if;
    out:=out||jsonb_build_array(item);
  end loop;
  return out;
end;
$$;

create or replace function public.save_lecturer_quiz_response_v1(p_quiz_id uuid,p_display_question integer,p_answer text,p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=private.require_user(); q private.lecturer_course_quizzes; a private.lecturer_course_quiz_attempts; cq integer; v_type text;
begin
  select * into q from private.lecturer_course_quizzes where id=p_quiz_id for share;
  if not found or not (private.quiz_class_student(q.offering_id,u) or (exists(select 1 from private.lecturer_course_quiz_attempts x where x.quiz_id=p_quiz_id and x.user_id=u) and private.classroom_attempt_access(q.classroom_id,u))) then perform private.raise_error('FORBIDDEN'); end if;
  select * into a from private.lecturer_course_quiz_attempts where quiz_id=p_quiz_id and user_id=u and submitted_at is null and expires_at>clock_timestamp() order by attempt_number desc limit 1 for update;
  if not found then perform private.raise_error('DEADLINE_PASSED'); end if;
  if p_display_question is null or p_display_question<0 or p_display_question>=array_length(a.question_order,1) or length(coalesce(p_answer,''))>12000 then perform private.raise_error('VALIDATION_FAILED'); end if;
  cq:=a.question_order[p_display_question+1]; v_type:=coalesce(q.questions->cq->>'type','mcq');
  if v_type not in ('written','fill_blank','oral') then perform private.raise_error('VALIDATION_FAILED','This question does not accept a written response.'); end if;
  if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
  update private.lecturer_course_quiz_attempts set answers=jsonb_set(answers,array[cq::text],to_jsonb(btrim(coalesce(p_answer,''))),true),revision=revision+1 where id=a.id;
  return public.get_course_quiz_v1(p_quiz_id);
end;
$$;

create or replace function public.get_lecturer_quiz_written_responses_v1(p_quiz_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=private.require_user(); q private.lecturer_course_quizzes; v_items jsonb;
begin
  select * into q from private.lecturer_course_quizzes where id=p_quiz_id;
  if not found or not (private.challenge_teacher(q.offering_id,u) or private.classroom_teacher(q.classroom_id,u)) then perform private.raise_error('FORBIDDEN'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',a.id,'student_name',a.display_name_snapshot,'matric_number',a.matric_number,
    'question_index',positions.display_position-1,'question_type',q.questions->selected.cq->>'type',
    'prompt',q.questions->selected.cq->>'prompt','expected_answer',q.questions->selected.cq->>'expected_answer',
    'response',case when jsonb_typeof(a.answers->(selected.cq::text))='object'
      then (a.answers->(selected.cq::text))->>'response' else a.answers->>(selected.cq::text) end,
    'score',((a.answers->(selected.cq::text))->>'score')::int,
    'feedback',(a.answers->(selected.cq::text))->>'feedback'
  ) order by a.submitted_at,a.display_name_snapshot,positions.display_position),'[]'::jsonb)
    into v_items
  from private.lecturer_course_quiz_attempts a
  cross join lateral generate_subscripts(a.question_order,1) as positions(display_position)
  cross join lateral (select a.question_order[positions.display_position] as cq) selected
  where a.quiz_id=p_quiz_id and a.submitted_at is not null and coalesce(q.questions->selected.cq->>'type','mcq') in ('written','oral');
  return private.envelope(jsonb_build_object('items',v_items));
end;
$$;

create or replace function public.grade_lecturer_quiz_written_response_v1(p_quiz_id uuid,p_attempt_id uuid,p_question_index integer,p_score integer,p_feedback text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=private.require_user(); q private.lecturer_course_quizzes; a private.lecturer_course_quiz_attempts; cq integer; v_response text;
begin
  select * into q from private.lecturer_course_quizzes where id=p_quiz_id;
  if not found or not (private.challenge_teacher(q.offering_id,u) or private.classroom_teacher(q.classroom_id,u)) then perform private.raise_error('FORBIDDEN'); end if;
  if p_score not in (0,1) or length(coalesce(p_feedback,''))>2000 then perform private.raise_error('VALIDATION_FAILED'); end if;
  select * into a from private.lecturer_course_quiz_attempts where id=p_attempt_id and quiz_id=p_quiz_id and submitted_at is not null for update;
  if not found or p_question_index<0 or p_question_index>=array_length(a.question_order,1) then perform private.raise_error('NOT_FOUND'); end if;
  cq:=a.question_order[p_question_index+1];
  if coalesce(q.questions->cq->>'type','mcq') not in ('written','oral') then perform private.raise_error('VALIDATION_FAILED'); end if;
  v_response:=case when jsonb_typeof(a.answers->(cq::text))='object' then (a.answers->(cq::text))->>'response' else a.answers->>(cq::text) end;
  update private.lecturer_course_quiz_attempts set answers=jsonb_set(answers,array[cq::text],jsonb_build_object('response',coalesce(v_response,''),'score',p_score,'feedback',btrim(coalesce(p_feedback,''))),true),score=private.quiz_score(q.questions,jsonb_set(answers,array[cq::text],jsonb_build_object('response',coalesce(v_response,''),'score',p_score,'feedback',btrim(coalesce(p_feedback,''))),true)),revision=revision+1 where id=a.id;
  return private.envelope(jsonb_build_object('attempt_id',a.id,'score',private.quiz_score(q.questions,jsonb_set(a.answers,array[cq::text],jsonb_build_object('response',coalesce(v_response,''),'score',p_score,'feedback',btrim(coalesce(p_feedback,''))),true))));
end;
$$;

revoke all on function public.save_lecturer_quiz_response_v1(uuid,integer,text,integer),public.get_lecturer_quiz_written_responses_v1(uuid),public.grade_lecturer_quiz_written_response_v1(uuid,uuid,integer,integer,text) from public,anon;
grant execute on function public.save_lecturer_quiz_response_v1(uuid,integer,text,integer),public.get_lecturer_quiz_written_responses_v1(uuid),public.grade_lecturer_quiz_written_response_v1(uuid,uuid,integer,integer,text) to authenticated;
