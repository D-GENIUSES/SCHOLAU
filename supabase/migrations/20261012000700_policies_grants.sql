-- ScholAu migration 7: RLS, grants, function execute allowlist, Realtime and Storage authorization.
-- Deny by default: RLS on every table, no client mutation grants anywhere, narrow SELECT policies only
-- where the access matrix allows direct reads. Answer keys and attempt/battle internals are RPC-only.

-- ---------------------------------------------------------------------------
-- 1. RLS everywhere + revoke Supabase default grants
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname in ('public', 'private')
  loop
    execute format('alter table %I.%I enable row level security', t.schema_name, t.table_name);
    execute format('revoke all on table %I.%I from public, anon, authenticated', t.schema_name, t.table_name);
    execute format('grant all on table %I.%I to service_role', t.schema_name, t.table_name);
  end loop;
end
$$;

revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Narrow SELECT grants (RLS still filters rows)
-- ---------------------------------------------------------------------------
-- Public catalog/config (onboarding lists, app_config for compatibility gate before sign-in)
grant select on public.universities, public.faculties, public.departments, public.levels,
                public.academic_periods, public.semesters, public.app_config to anon, authenticated;

-- Authenticated reads (own rows / enrolled content / admin support)
grant select on public.courses, public.course_offerings, public.profiles, public.user_roles,
                public.academic_profile_changes, public.enrollments, public.modules, public.lessons,
                public.lesson_versions, public.assessments, public.assessment_versions,
                public.lesson_progress, public.activity_events, public.points_ledger, public.user_points,
                public.entitlements, public.battle_rules, public.notifications, public.content_reports,
                public.push_tokens,
                -- admin-only via policy below; students get no rows
                public.questions, public.question_versions, public.question_options,
                public.assessment_questions, public.assessment_attempts, public.battles,
                public.battle_participants, public.battle_queue
  to authenticated;

-- Intentionally NO grants for authenticated on: attempt_questions, attempt_answers,
-- battle_questions, battle_answers (RPC-only), and nothing in schema private.

-- ---------------------------------------------------------------------------
-- 3. Policies
-- ---------------------------------------------------------------------------
-- Academic hierarchy: active rows readable by everyone (needed for onboarding).
create policy universities_read on public.universities for select to anon, authenticated using (active or authz.is_admin());
create policy faculties_read on public.faculties for select to anon, authenticated using (active or authz.is_admin());
create policy departments_read on public.departments for select to anon, authenticated using (active or authz.is_admin());
create policy levels_read on public.levels for select to anon, authenticated using (active or authz.is_admin());
create policy periods_read on public.academic_periods for select to anon, authenticated using (active or authz.is_admin());
create policy semesters_read on public.semesters for select to anon, authenticated using (active or authz.is_admin());
create policy app_config_read on public.app_config for select to anon, authenticated using (true);
create policy battle_rules_read on public.battle_rules for select to authenticated using (published_at is not null or authz.is_admin());

-- Catalog: published offerings and their courses.
create policy offerings_read on public.course_offerings for select to authenticated
  using (status = 'published' or authz.is_admin());
create policy courses_read on public.courses for select to authenticated
  using ((active and exists (select 1 from public.course_offerings o where o.course_id = courses.id and o.status = 'published'))
         or authz.is_admin());

-- Own identity rows.
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or authz.is_admin());
create policy user_roles_read_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy academic_changes_read_own on public.academic_profile_changes for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy enrollments_read_own on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());

-- Content: enrolled users read structure + published lesson versions; admins read drafts.
create policy modules_read on public.modules for select to authenticated
  using (authz.is_enrolled_in_course(course_id) or authz.is_admin());
create policy lessons_read on public.lessons for select to authenticated
  using (authz.is_enrolled_in_course(course_id) or authz.is_admin());
create policy lesson_versions_read on public.lesson_versions for select to authenticated
  using ((status = 'published' and exists (select 1 from public.lessons l where l.id = lesson_versions.lesson_id
                                            and authz.is_enrolled_in_course(l.course_id)))
         or authz.is_admin());
create policy assessments_read on public.assessments for select to authenticated
  using (authz.is_enrolled_in_course(course_id) or authz.is_admin());
create policy assessment_versions_read on public.assessment_versions for select to authenticated
  using ((status = 'published' and exists (select 1 from public.assessments a where a.id = assessment_versions.assessment_id
                                            and authz.is_enrolled_in_course(a.course_id)))
         or authz.is_admin());

-- Question bank, assessment composition and competition internals: admin read only.
create policy questions_admin_read on public.questions for select to authenticated using (authz.is_admin());
create policy question_versions_admin_read on public.question_versions for select to authenticated using (authz.is_admin());
create policy question_options_admin_read on public.question_options for select to authenticated using (authz.is_admin());
create policy assessment_questions_admin_read on public.assessment_questions for select to authenticated using (authz.is_admin());
create policy attempts_admin_read on public.assessment_attempts for select to authenticated using (authz.is_admin());
create policy battles_admin_read on public.battles for select to authenticated using (authz.is_admin());
create policy battle_participants_admin_read on public.battle_participants for select to authenticated using (authz.is_admin());
create policy battle_queue_admin_read on public.battle_queue for select to authenticated using (authz.is_admin());

-- Own progress, XP and activity.
create policy lesson_progress_read_own on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy activity_read_own on public.activity_events for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy ledger_read_own on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy user_points_read_own on public.user_points for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy entitlements_read_own on public.entitlements for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy notifications_read_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy reports_read_own on public.content_reports for select to authenticated
  using (user_id = (select auth.uid()) or authz.is_admin());
create policy push_tokens_read_own on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Function execute allowlist
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;
grant execute on function authz.is_admin() to anon, authenticated, service_role;
grant execute on function authz.is_enrolled_in_course(uuid) to anon, authenticated, service_role;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_my_profile_v1', 'update_profile_v1', 'get_onboarding_options_v1', 'set_academic_profile_v1',
        'get_catalog_v1', 'enroll_course_v1', 'get_course_overview_v1', 'get_lesson_v1', 'start_lesson_v1',
        'complete_lesson_v1', 'start_attempt_v1', 'save_attempt_answers_v1', 'check_review_answer_v1',
        'submit_attempt_v1', 'get_attempt_result_v1', 'get_home_summary_v1', 'report_content_v1',
        'mark_notification_read_v1', 'register_push_token_v1', 'revoke_push_token_v1',
        'create_direct_battle_v1', 'accept_battle_v1', 'join_queue_v1', 'leave_queue_v1', 'get_my_live_battle_v1',
        'ready_battle_v1', 'get_battle_state_v1', 'submit_battle_answer_v1', 'forfeit_battle_v1',
        'get_my_battles_v1', 'get_leaderboard_v1',
        'admin_publish_v1', 'admin_retire_v1', 'admin_get_question_v1', 'admin_import_questions_v1',
        'admin_import_lessons_v1', 'admin_upsert_assessment_draft_v1', 'admin_correct_result_v1',
        'admin_correct_academic_profile_v1', 'admin_set_role_v1', 'admin_grant_premium_v1',
        'admin_revoke_premium_v1', 'admin_triage_report_v1', 'admin_list_audit_v1')
  loop
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Realtime authorization (private channels)
--    Topics: 'battle:<battle_id>' (participants only), 'user:<auth.uid()>' (owner only).
--    Clients may only use Presence (connectivity hint); all broadcasts are server-originated via
--    realtime.send from private.enqueue_event/dispatch_outbox and carry redacted state only.
-- ---------------------------------------------------------------------------
create or replace function authz.can_access_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_topic is null then
    return false;
  end if;
  if p_topic = 'user:' || v_uid::text then
    return true;
  end if;
  if p_topic ~ '^battle:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (select 1 from public.battle_participants bp
                   where bp.battle_id = substr(p_topic, 8)::uuid and bp.user_id = v_uid);
  end if;
  return false;
end;
$$;

revoke all on function authz.can_access_topic(text) from public;
grant execute on function authz.can_access_topic(text) to authenticated, service_role;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists scholau_topic_receive on realtime.messages';
    execute 'drop policy if exists scholau_topic_presence on realtime.messages';
    execute $p$
      create policy scholau_topic_receive on realtime.messages for select to authenticated
      using (realtime.messages.extension in ('broadcast', 'presence') and authz.can_access_topic((select realtime.topic())))
    $p$;
    execute $p$
      create policy scholau_topic_presence on realtime.messages for insert to authenticated
      with check (realtime.messages.extension = 'presence' and authz.can_access_topic((select realtime.topic())))
    $p$;
  else
    raise notice 'realtime.messages not present; Realtime policies skipped';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Storage: private lesson-assets bucket.
--    Object name convention: <course_id>/<lesson_id>/<file>. Students may read an object only when
--    it is referenced by an image block of a published version of that lesson and they are enrolled.
--    Admins write. Clients should request signed URLs (createSignedUrl) for rendering.
-- ---------------------------------------------------------------------------
create or replace function authz.can_read_lesson_asset(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_lesson uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  begin
    v_course := split_part(p_name, '/', 1)::uuid;
    v_lesson := split_part(p_name, '/', 2)::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.lessons l
    join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
    where l.id = v_lesson and l.course_id = v_course
      and lv.blocks @> jsonb_build_array(jsonb_build_object('type', 'image', 'path', p_name))
  ) and authz.is_enrolled_in_course(v_course);
end;
$$;

revoke all on function authz.can_read_lesson_asset(text) from public;
grant execute on function authz.can_read_lesson_asset(text) to authenticated, service_role;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('lesson-assets', 'lesson-assets', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;

    execute 'drop policy if exists scholau_lesson_assets_read on storage.objects';
    execute 'drop policy if exists scholau_lesson_assets_insert on storage.objects';
    execute 'drop policy if exists scholau_lesson_assets_update on storage.objects';
    execute 'drop policy if exists scholau_lesson_assets_delete on storage.objects';
    execute $p$
      create policy scholau_lesson_assets_read on storage.objects for select to authenticated
      using (bucket_id = 'lesson-assets' and authz.can_read_lesson_asset(name))
    $p$;
    execute $p$
      create policy scholau_lesson_assets_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'lesson-assets' and authz.is_admin())
    $p$;
    execute $p$
      create policy scholau_lesson_assets_update on storage.objects for update to authenticated
      using (bucket_id = 'lesson-assets' and authz.is_admin())
      with check (bucket_id = 'lesson-assets' and authz.is_admin())
    $p$;
    execute $p$
      create policy scholau_lesson_assets_delete on storage.objects for delete to authenticated
      using (bucket_id = 'lesson-assets' and authz.is_admin())
    $p$;
  else
    raise notice 'storage schema not present; bucket/policies skipped';
  end if;
end
$$;
