create or replace function public.publish_lecturer_quiz_v1(p_id uuid, p_revision integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_user(); q private.lecturer_course_quizzes;
begin
 select * into q from private.lecturer_course_quizzes where id=p_id for update;
 if not found or not private.challenge_teacher(q.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if q.status='published' then return private.envelope(jsonb_build_object('quiz',private.quiz_summary(q))); end if;
 if q.status<>'draft' or q.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
 if jsonb_array_length(q.questions) not between 1 and 200 then perform private.raise_error('VALIDATION_FAILED','Add at least one question.'); end if;
 if q.opens_at is null or q.closes_at is null or q.closes_at<=q.opens_at or q.closes_at<=clock_timestamp() then perform private.raise_error('VALIDATION_FAILED','Set a future quiz window.'); end if;
 update private.lecturer_course_quizzes set status='published',revision=revision+1 where id=p_id returning * into q;
 insert into public.notifications(user_id,kind,body,safe_target,event_key) select e.user_id,'course_quiz','New course quiz: '||q.title,'/course-quizzes/'||q.id::text,'course-quiz:'||q.id::text||':'||e.user_id::text from public.enrollments e where e.offering_id=q.offering_id and e.ended_at is null and private.challenge_student(q.offering_id,e.user_id) on conflict(event_key) do nothing;
 perform private.audit(u,'publish_lecturer_quiz','lecturer_quiz',q.id,null); return private.envelope(jsonb_build_object('quiz',private.quiz_summary(q)));
end; $$;
