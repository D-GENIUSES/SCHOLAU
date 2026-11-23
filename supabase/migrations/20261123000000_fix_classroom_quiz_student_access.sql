begin;

-- Classroom quizzes use classroom membership as the authoritative student gate.
-- Do not require the student to be enrolled in the lecturer's exact offering,
-- since a member may have joined through a sibling programme offering.
create or replace function private.quiz_student_can_access(p_quiz_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from private.lecturer_course_quizzes q
    where q.id = p_quiz_id
      and private.quiz_audience_eligible(p_quiz_id, p_user_id)
      and (
        q.classroom_id is not null
          and private.classroom_student_access(q.classroom_id, p_user_id)
        or q.classroom_id is null
          and private.quiz_class_student(q.offering_id, p_user_id)
      )
  )
$$;

revoke all on function private.quiz_student_can_access(uuid, uuid) from public, anon, authenticated;

-- Restore classroom-only notifications after the 200-question publish migration
-- recreated publish_lecturer_quiz_v1 with the course-wide notification query.
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
 if q.classroom_id is not null then
   insert into public.notifications(user_id,kind,body,safe_target,event_key)
   select m.user_id,'course_quiz','New course quiz: '||q.title,'/course-quizzes/'||q.id::text,
          'course-quiz:'||q.id::text||':'||m.user_id::text
   from private.lecturer_classroom_members m
   where m.classroom_id=q.classroom_id
     and private.classroom_student_access(q.classroom_id,m.user_id)
     and private.quiz_audience_eligible(q.id,m.user_id)
   on conflict(event_key) do nothing;
 else
   insert into public.notifications(user_id,kind,body,safe_target,event_key)
   select e.user_id,'course_quiz','New course quiz: '||q.title,'/course-quizzes/'||q.id::text,
          'course-quiz:'||q.id::text||':'||e.user_id::text
   from public.enrollments e
   where e.offering_id=q.offering_id and e.ended_at is null
     and private.challenge_student(q.offering_id,e.user_id)
     and private.quiz_audience_eligible(q.id,e.user_id)
   on conflict(event_key) do nothing;
 end if;
 perform private.audit(u,'publish_lecturer_quiz','lecturer_quiz',q.id,null);
 return private.envelope(jsonb_build_object('quiz',private.quiz_summary(q)));
end;
$$;

revoke all on function public.publish_lecturer_quiz_v1(uuid, integer) from public, anon;
grant execute on function public.publish_lecturer_quiz_v1(uuid, integer) to authenticated;

commit;
