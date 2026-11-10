-- Unblock admin account deletion when lecturers own quizzes, challenges, or related private rows.
begin;

create or replace function private.lock_managed_target(p_user_id uuid, p_expected_updated_at timestamptz, p_protect_admin boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  select * into target from public.profiles where id = p_user_id for update;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  if p_protect_admin and (
    p_user_id = auth.uid()
    or exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin')
  ) then
    perform private.raise_error('FORBIDDEN', 'Administrator accounts are protected.');
  end if;
  if p_expected_updated_at is not null and target.updated_at is distinct from p_expected_updated_at then
    perform private.raise_error('STALE_REVISION');
  end if;
end $$;

create or replace function private.erase_auth_user_data()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_battle uuid; v_profile public.profiles; v_offering uuid;
begin
  for v_offering in
    select offering_id from public.battle_queue where user_id = old.id and state = 'waiting' order by offering_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('scholau.queue:' || v_offering::text, 0));
  end loop;
  for v_battle in
    select b.id from public.battles b
    where b.created_by = old.id or exists (
      select 1 from public.battle_participants bp where bp.battle_id = b.id and bp.user_id = old.id
    )
    order by b.id for update of b
  loop
    perform private.cancel_battle(v_battle, 'pre_start_cancel', 'cancelled');
  end loop;
  select * into v_profile from public.profiles where id = old.id for update;
  if not found then return old; end if;
  insert into private.account_erasure_context(user_id) values (old.id);

  update public.battles set winner_user_id = null where winner_user_id = old.id;
  update public.battles set created_by = null, request_key = null where created_by = old.id;
  delete from public.battle_answers where user_id = old.id;
  delete from public.battle_participants where user_id = old.id;
  delete from private.battle_slots where user_id = old.id;
  delete from public.battle_queue where user_id = old.id;
  delete from private.battle_opponent_counts where user_id = old.id or opponent_id = old.id;
  delete from private.battle_xp_counts where user_id = old.id;

  delete from private.review_awards where user_id = old.id;
  delete from public.attempt_answers where attempt_id in (select id from public.assessment_attempts where user_id = old.id);
  delete from public.attempt_questions where attempt_id in (select id from public.assessment_attempts where user_id = old.id);
  delete from public.assessment_attempts where user_id = old.id;
  delete from public.lesson_progress where user_id = old.id;
  delete from public.activity_events where user_id = old.id;
  delete from private.topic_mastery where user_id = old.id;
  delete from private.xp_bests where user_id = old.id;
  delete from private.xp_badges where user_id = old.id;
  delete from private.daily_counters where user_id = old.id;

  update public.points_ledger set actor_id = null where actor_id = old.id and user_id <> old.id;
  delete from public.points_ledger where user_id = old.id;
  delete from public.user_points where user_id = old.id;
  delete from public.enrollments where user_id = old.id;
  delete from public.entitlements where user_id = old.id;
  update public.entitlements set granted_by = null where granted_by = old.id;
  update public.entitlements set revoked_by = null where revoked_by = old.id;
  delete from public.push_tokens where user_id = old.id;
  delete from public.notifications where user_id = old.id;
  delete from public.content_reports where user_id = old.id;
  update public.content_reports set resolved_by = null where resolved_by = old.id;
  delete from public.academic_profile_changes where user_id = old.id;
  update public.academic_profile_changes set actor_id = null where actor_id = old.id;
  delete from public.user_roles where user_id = old.id;
  update public.user_roles set granted_by = null where granted_by = old.id;

  delete from private.lecturer_course_quiz_attempts
  where user_id = old.id
     or quiz_id in (select id from private.lecturer_course_quizzes where created_by = old.id);
  delete from private.lecturer_quiz_import_jobs
  where created_by = old.id
     or quiz_id in (select id from private.lecturer_course_quizzes where created_by = old.id);
  delete from private.lecturer_course_quizzes where created_by = old.id;

  delete from private.course_challenge_attempts
  where user_id = old.id
     or challenge_id in (select id from private.course_challenges where created_by = old.id);
  delete from private.course_challenges where created_by = old.id;

  delete from private.light_course_assignments where created_by = old.id;

  delete from private.student_material_submissions where student_id = old.id;
  update private.student_material_submissions set reviewed_by = null where reviewed_by = old.id;

  delete from private.welcome_email_events where user_id = old.id;
  delete from private.engagement_email_jobs where user_id = old.id;
  delete from private.engagement_email_opt_outs where user_id = old.id;

  update public.lesson_versions set reviewed_by = null, reviewer_deleted = true where reviewed_by = old.id;
  update public.lesson_versions set retired_by = null where retired_by = old.id;
  update public.question_versions set reviewed_by = null, reviewer_deleted = true where reviewed_by = old.id;
  update public.question_versions set retired_by = null where retired_by = old.id;
  update public.assessment_versions set reviewed_by = null, reviewer_deleted = true where reviewed_by = old.id;
  update public.assessment_versions set retired_by = null where retired_by = old.id;
  delete from private.audit_log where actor_id = old.id or entity_id = old.id
    or safe_metadata::text like '%' || old.id::text || '%';
  delete from private.outbox where topic like '%' || old.id::text || '%' or event_key like '%' || old.id::text || '%'
    or safe_payload::text like '%' || old.id::text || '%';
  delete from public.profiles where id = old.id;
  delete from private.account_erasure_context where user_id = old.id;
  return old;
end;
$$;

commit;
