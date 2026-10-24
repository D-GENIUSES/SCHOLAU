-- Admin dashboard aggregate + cursor-paginated list RPCs + platform admin RPCs

create or replace function public.admin_dashboard_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_push jsonb;
begin
  select public.admin_push_health_v1() into v_push;

  return private.envelope(jsonb_build_object(
    'counts', jsonb_build_object(
      'lessons_draft', (select count(*) from public.lesson_versions where status = 'draft'),
      'lessons_published', (select count(*) from public.lesson_versions where status = 'published'),
      'questions_draft', (select count(*) from public.question_versions where status = 'draft'),
      'questions_published', (select count(*) from public.question_versions where status = 'published'),
      'assessments_draft', (select count(*) from public.assessment_versions where status = 'draft'),
      'assessments_published', (select count(*) from public.assessment_versions where status = 'published'),
      'offerings_published', (select count(*) from public.course_offerings where status = 'published'),
      'reports_open', (select count(*) from public.content_reports where state = 'open'),
      'battles_active', (select count(*) from public.battles where state in ('waiting', 'ready', 'countdown', 'active')),
      'lecturer_applications_pending', (select count(*) from public.lecturer_applications where status = 'pending')
    ),
    'push', v_push,
    'queues', jsonb_build_object(
      'open_reports', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at asc) from (
          select id, category, target_type, left(note, 120) as note_preview, created_at
          from public.content_reports
          where state = 'open'
          order by created_at asc
          limit 5
        ) x
      ), '[]'::jsonb),
      'draft_lessons', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at asc) from (
          select id, title, created_at
          from public.lesson_versions
          where status = 'draft'
          order by created_at asc
          limit 5
        ) x
      ), '[]'::jsonb),
      'draft_questions', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at asc) from (
          select id, left(prompt, 120) as prompt_preview, created_at
          from public.question_versions
          where status = 'draft'
          order by created_at asc
          limit 5
        ) x
      ), '[]'::jsonb),
      'pending_lecturer_applications', coalesce((
        select jsonb_agg(to_jsonb(x) order by x.created_at asc) from (
          select a.id, a.full_name, a.university, a.created_at
          from public.lecturer_applications a
          where a.status = 'pending'
          order by a.created_at asc
          limit 5
        ) x
      ), '[]'::jsonb)
    ),
    'recent_audit', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.reason, a.safe_metadata, a.created_at
        from private.audit_log a
        order by a.created_at desc
        limit 10
      ) x
    ), '[]'::jsonb)
  ));
end;
$$;
-- Cursor pagination: (created_at, id) encoded as timestamptz||'|'||uuid
create or replace function private.admin_decode_cursor(p_cursor text, out ts timestamptz, out row_id uuid)
returns record
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_cursor is null or btrim(p_cursor) = '' then
    ts := null;
    row_id := null;
    return;
  end if;
  ts := split_part(p_cursor, '|', 1)::timestamptz;
  row_id := split_part(p_cursor, '|', 2)::uuid;
end;
$$;
create or replace function public.admin_list_reports_v1(
  p_state text default null,
  p_cursor text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_cur record;
  v_rows jsonb;
  v_next text;
begin
  select * into v_cur from private.admin_decode_cursor(p_cursor) as t(ts timestamptz, row_id uuid);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows
  from (
    select r.id, r.user_id, r.target_type, r.target_id, r.category, r.note, r.state, r.resolution, r.created_at, r.resolved_at
    from public.content_reports r
    where (p_state is null or r.state = p_state)
      and (
        v_cur.ts is null
        or (r.created_at, r.id) < (v_cur.ts, v_cur.row_id)
      )
    order by r.created_at desc, r.id desc
    limit v_lim + 1
  ) x;

  if jsonb_array_length(v_rows) > v_lim then
    v_next := (v_rows->v_lim->>'created_at') || '|' || (v_rows->v_lim->>'id');
    v_rows := (select jsonb_agg(e) from jsonb_array_elements(v_rows) with ordinality as t(e, i) where i <= v_lim);
  else
    v_next := null;
  end if;

  return private.envelope(jsonb_build_object('items', v_rows, 'next_cursor', v_next));
end;
$$;
create or replace function public.admin_list_battles_v1(
  p_state text default null,
  p_cursor text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_cur record;
  v_rows jsonb;
  v_next text;
begin
  select * into v_cur from private.admin_decode_cursor(p_cursor) as t(ts timestamptz, row_id uuid);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows
  from (
    select b.id, b.mode, b.state, b.result_kind, b.cancel_reason, b.created_at, b.finalized_at, b.offering_id
    from public.battles b
    where (p_state is null or b.state = p_state)
      and (v_cur.ts is null or (b.created_at, b.id) < (v_cur.ts, v_cur.row_id))
    order by b.created_at desc, b.id desc
    limit v_lim + 1
  ) x;

  if jsonb_array_length(v_rows) > v_lim then
    v_next := (v_rows->v_lim->>'created_at') || '|' || (v_rows->v_lim->>'id');
    v_rows := (select jsonb_agg(e) from jsonb_array_elements(v_rows) with ordinality as t(e, i) where i <= v_lim);
  else
    v_next := null;
  end if;

  return private.envelope(jsonb_build_object('items', v_rows, 'next_cursor', v_next));
end;
$$;
create or replace function public.admin_list_entitlements_v1(
  p_cursor text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_cur record;
  v_rows jsonb;
  v_next text;
begin
  select * into v_cur from private.admin_decode_cursor(p_cursor) as t(ts timestamptz, row_id uuid);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows
  from (
    select e.id, e.user_id, e.feature, e.source, e.starts_at, e.ends_at, e.revoked_at, e.reason, e.created_at
    from public.entitlements e
    where v_cur.ts is null or (e.created_at, e.id) < (v_cur.ts, v_cur.row_id)
    order by e.created_at desc, e.id desc
    limit v_lim + 1
  ) x;

  if jsonb_array_length(v_rows) > v_lim then
    v_next := (v_rows->v_lim->>'created_at') || '|' || (v_rows->v_lim->>'id');
    v_rows := (select jsonb_agg(e) from jsonb_array_elements(v_rows) with ordinality as t(e, i) where i <= v_lim);
  else
    v_next := null;
  end if;

  return private.envelope(jsonb_build_object('items', v_rows, 'next_cursor', v_next));
end;
$$;
create or replace function public.admin_list_attempts_v1(
  p_user_id uuid default null,
  p_cursor text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_lim integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_cur record;
  v_rows jsonb;
  v_next text;
begin
  select * into v_cur from private.admin_decode_cursor(p_cursor) as t(ts timestamptz, row_id uuid);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows
  from (
    select a.id, a.user_id, a.assessment_id, a.status, a.correct_count, a.total_count, a.started_at, a.finalized_at
    from public.assessment_attempts a
    where (p_user_id is null or a.user_id = p_user_id)
      and (v_cur.ts is null or (a.started_at, a.id) < (v_cur.ts, v_cur.row_id))
    order by a.started_at desc, a.id desc
    limit v_lim + 1
  ) x;

  if jsonb_array_length(v_rows) > v_lim then
    v_next := (v_rows->v_lim->>'started_at') || '|' || (v_rows->v_lim->>'id');
    v_rows := (select jsonb_agg(e) from jsonb_array_elements(v_rows) with ordinality as t(e, i) where i <= v_lim);
  else
    v_next := null;
  end if;

  return private.envelope(jsonb_build_object('items', v_rows, 'next_cursor', v_next));
end;
$$;
create or replace function public.admin_get_app_config_v1(p_platform text default 'web')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_row public.app_config;
begin
  select * into v_row from public.app_config where platform = p_platform;
  if not found then
    perform private.raise_error('NOT_FOUND');
  end if;
  return private.envelope(to_jsonb(v_row));
end;
$$;
create or replace function public.admin_update_app_config_v1(
  p_platform text,
  p_maintenance boolean,
  p_message text,
  p_minimum_build integer,
  p_minimum_api_version integer,
  p_feature_flags jsonb,
  p_reason text,
  p_request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_row public.app_config;
begin
  if p_reason is null or length(btrim(p_reason)) < 3 then
    perform private.raise_error('VALIDATION_FAILED', 'A reason of at least 3 characters is required.');
  end if;

  update public.app_config
  set maintenance = p_maintenance,
      message = nullif(btrim(p_message), ''),
      minimum_build = p_minimum_build,
      minimum_api_version = p_minimum_api_version,
      feature_flags = coalesce(p_feature_flags, '{}'::jsonb),
      updated_at = now()
  where platform = p_platform
  returning * into v_row;

  if not found then
    perform private.raise_error('NOT_FOUND');
  end if;

  perform private.audit(v_uid, 'update_app_config', 'app_config', null, p_request_key, p_reason,
    jsonb_build_object('platform', p_platform, 'maintenance', p_maintenance));

  return private.envelope(to_jsonb(v_row), p_request_key);
end;
$$;
create or replace function public.admin_analytics_summary_v1(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_admin();
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 90);
  v_since timestamptz := now() - make_interval(days => v_days);
begin
  return private.envelope(jsonb_build_object(
    'days', v_days,
    'since', v_since,
    'new_profiles', (select count(*) from public.profiles where created_at >= v_since),
    'attempts_completed', (select count(*) from public.assessment_attempts where finalized_at >= v_since and status = 'submitted'),
    'battles_finished', (select count(*) from public.battles where finalized_at >= v_since and state = 'finished'),
    'reports_filed', (select count(*) from public.content_reports where created_at >= v_since),
    'premium_grants', (select count(*) from public.entitlements where created_at >= v_since and feature = 'premium')
  ));
end;
$$;
revoke all on function private.admin_decode_cursor(text) from public, anon, authenticated, service_role;
revoke all on function public.admin_dashboard_v1(),
  public.admin_list_reports_v1(text, text, integer),
  public.admin_list_battles_v1(text, text, integer),
  public.admin_list_entitlements_v1(text, integer),
  public.admin_list_attempts_v1(uuid, text, integer),
  public.admin_get_app_config_v1(text),
  public.admin_update_app_config_v1(text, boolean, text, integer, integer, jsonb, text, uuid),
  public.admin_analytics_summary_v1(integer)
from public, anon, service_role;
grant execute on function public.admin_dashboard_v1(),
  public.admin_list_reports_v1(text, text, integer),
  public.admin_list_battles_v1(text, text, integer),
  public.admin_list_entitlements_v1(text, integer),
  public.admin_list_attempts_v1(uuid, text, integer),
  public.admin_get_app_config_v1(text),
  public.admin_update_app_config_v1(text, boolean, text, integer, integer, jsonb, text, uuid),
  public.admin_analytics_summary_v1(integer)
to authenticated;
