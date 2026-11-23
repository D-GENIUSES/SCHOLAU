begin;

-- A classroom member is eligible for that classroom's quiz once they have
-- successfully joined the room. Do not make a later/stale course enrollment
-- lookup invalidate an already-validated classroom membership.
create or replace function private.classroom_student_access(p_classroom_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from private.lecturer_classrooms c
    join private.lecturer_classroom_members m
      on m.classroom_id = c.id
     and m.user_id = p_user_id
    where c.id = p_classroom_id
      and c.archived_at is null
  )
$$;

-- Classroom audience: room membership is authoritative. Audience settings
-- remain enforced only for course-wide quizzes.
create or replace function private.quiz_student_can_access(p_quiz_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from private.lecturer_course_quizzes q
    where q.id = p_quiz_id
      and (
        q.classroom_id is not null
          and private.classroom_student_access(q.classroom_id, p_user_id)
        or q.classroom_id is null
          and private.quiz_class_student(q.offering_id, p_user_id)
          and private.quiz_audience_eligible(p_quiz_id, p_user_id)
      )
  )
$$;

revoke all on function private.classroom_student_access(uuid, uuid),
  private.quiz_student_can_access(uuid, uuid)
  from public, anon, authenticated;

commit;
