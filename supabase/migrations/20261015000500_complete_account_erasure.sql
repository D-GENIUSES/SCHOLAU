-- Hard deletion from Supabase Auth: atomic personal-data erasure.
-- Installing this migration deletes no accounts. No public erasure RPC is exposed.
-- Shared course content, opponents' results, and opponents' XP are preserved.
create table private.account_erasure_context (user_id uuid primary key);
alter table private.account_erasure_context enable row level security;
revoke all on private.account_erasure_context from public, anon, authenticated, service_role;

-- Nullable attribution permits deleting an author without deleting shared records.
alter table public.battles alter column created_by drop not null;
alter table public.academic_profile_changes alter column actor_id drop not null;
-- Keep publication validation while allowing a deleted reviewer's identity to be erased.
do $$ declare t text; r record; begin
  foreach t in array array['lesson_versions','question_versions','assessment_versions'] loop
    execute format('alter table public.%I add column reviewer_deleted boolean not null default false',t);
    for r in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
      where conrelid=to_regclass('public.'||t) and contype='c'
      and pg_get_constraintdef(oid) like '%reviewed_by IS NOT NULL%' loop
      execute format('alter table public.%I drop constraint %I',t,r.conname);
      execute format('alter table public.%I add constraint %I %s',t,r.conname,
        replace(r.definition,'reviewed_by IS NOT NULL','(reviewed_by IS NOT NULL OR reviewer_deleted)'));
    end loop;
  end loop;
end $$;
do $$ declare r record; begin
  for r in select conname from pg_constraint where conrelid='public.entitlements'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%granted_by%' loop
    execute format('alter table public.entitlements drop constraint %I',r.conname);
  end loop;
end $$;
alter table public.entitlements add constraint admin_entitlement_reason_required
  check(source <> 'admin' or (reason is not null and length(reason)>0));

create or replace function private.ledger_append_only()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' and exists(select 1 from private.account_erasure_context where user_id=old.user_id) then
    return old;
  end if;
  if tg_op='UPDATE' and new.actor_id is null
     and (to_jsonb(new)-'actor_id')=(to_jsonb(old)-'actor_id')
     and exists(select 1 from private.account_erasure_context where user_id=old.actor_id) then
    return new;
  end if;
  raise exception 'points_ledger is append-only; use compensating correction entries' using errcode='check_violation';
end;
$$;
revoke all on function private.ledger_append_only() from public,anon,authenticated,service_role;

create or replace function private.guard_version_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ignored text[] := array['status', 'retired_at', 'retired_by', 'retired_reason'];
begin
  -- Only erase identity attribution while an Auth deletion is in progress.
  -- Published educational content and every other column remain immutable.
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['reviewed_by','retired_by','reviewer_deleted']) = (to_jsonb(old) - array['reviewed_by','retired_by','reviewer_deleted'])
     and (new.reviewer_deleted=old.reviewer_deleted or
          (new.reviewer_deleted and new.reviewed_by is null and exists(select 1 from private.account_erasure_context where user_id=old.reviewed_by)))
     and (new.reviewed_by is not distinct from old.reviewed_by or
          (new.reviewed_by is null and exists (select 1 from private.account_erasure_context where user_id=old.reviewed_by)))
     and (new.retired_by is not distinct from old.retired_by or
          (new.retired_by is null and exists (select 1 from private.account_erasure_context where user_id=old.retired_by)))
     and exists (select 1 from private.account_erasure_context where user_id in (old.reviewed_by,old.retired_by)) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not private.publishing_allowed() then
      raise exception 'new % rows must be drafts; publish through admin_publish_v1', tg_table_name
        using errcode = 'check_violation';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status = 'draft' then
      if new.status <> 'draft' and not private.publishing_allowed() then
        raise exception '% status changes require the publishing workflow', tg_table_name
          using errcode = 'check_violation';
      end if;
      return new;
    end if;
    if old.status = 'published' and new.status = 'retired'
       and (to_jsonb(new) - v_ignored) = (to_jsonb(old) - v_ignored) then
      return new;
    end if;
    raise exception 'published % rows are immutable', tg_table_name using errcode = 'check_violation';
  else
    if old.status <> 'draft' then
      raise exception 'published % rows cannot be deleted', tg_table_name using errcode = 'check_violation';
    end if;
    return old;
  end if;
end;
$$;
revoke all on function private.guard_version_row() from public,anon,authenticated,service_role;

create or replace function private.erase_auth_user_data()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_battle uuid; v_profile public.profiles; v_offering uuid;
begin
  -- Queue advisory locks precede battle locks, matching the gameplay lock order.
  for v_offering in select offering_id from public.battle_queue where user_id=old.id and state='waiting' order by offering_id loop
    perform pg_advisory_xact_lock(hashtextextended('scholau.queue:'||v_offering::text,0));
  end loop;
  for v_battle in select b.id from public.battles b where b.created_by=old.id or exists(
    select 1 from public.battle_participants bp where bp.battle_id=b.id and bp.user_id=old.id)
    order by b.id for update of b loop
    perform private.cancel_battle(v_battle,'pre_start_cancel','cancelled');
  end loop;
  select * into v_profile from public.profiles where id=old.id for update;
  if not found then return old; end if;
  insert into private.account_erasure_context(user_id) values(old.id);

  -- Remove only the deleted participant; preserve the other player's match and XP.
  update public.battles set winner_user_id=null where winner_user_id=old.id;
  update public.battles set created_by=null,request_key=null where created_by=old.id;
  delete from public.battle_answers where user_id=old.id;
  delete from public.battle_participants where user_id=old.id;
  delete from private.battle_slots where user_id=old.id;
  delete from public.battle_queue where user_id=old.id;
  delete from private.battle_opponent_counts where user_id=old.id or opponent_id=old.id;
  delete from private.battle_xp_counts where user_id=old.id;

  delete from private.review_awards where user_id=old.id;
  delete from public.attempt_answers where attempt_id in(select id from public.assessment_attempts where user_id=old.id);
  delete from public.attempt_questions where attempt_id in(select id from public.assessment_attempts where user_id=old.id);
  delete from public.assessment_attempts where user_id=old.id;
  delete from public.lesson_progress where user_id=old.id;
  delete from public.activity_events where user_id=old.id;
  delete from private.topic_mastery where user_id=old.id;
  delete from private.xp_bests where user_id=old.id;
  delete from private.xp_badges where user_id=old.id;
  delete from private.daily_counters where user_id=old.id;

  update public.points_ledger set actor_id=null where actor_id=old.id and user_id<>old.id;
  delete from public.points_ledger where user_id=old.id;
  delete from public.user_points where user_id=old.id;
  delete from public.enrollments where user_id=old.id;
  delete from public.entitlements where user_id=old.id;
  update public.entitlements set granted_by=null where granted_by=old.id;
  update public.entitlements set revoked_by=null where revoked_by=old.id;
  delete from public.push_tokens where user_id=old.id;
  delete from public.notifications where user_id=old.id;
  delete from public.content_reports where user_id=old.id;
  update public.content_reports set resolved_by=null where resolved_by=old.id;
  delete from public.academic_profile_changes where user_id=old.id;
  update public.academic_profile_changes set actor_id=null where actor_id=old.id;
  delete from public.user_roles where user_id=old.id;
  update public.user_roles set granted_by=null where granted_by=old.id;

  update public.lesson_versions set reviewed_by=null,reviewer_deleted=true where reviewed_by=old.id;
  update public.lesson_versions set retired_by=null where retired_by=old.id;
  update public.question_versions set reviewed_by=null,reviewer_deleted=true where reviewed_by=old.id;
  update public.question_versions set retired_by=null where retired_by=old.id;
  update public.assessment_versions set reviewed_by=null,reviewer_deleted=true where reviewed_by=old.id;
  update public.assessment_versions set retired_by=null where retired_by=old.id;
  delete from private.audit_log where actor_id=old.id or entity_id=old.id or safe_metadata::text like '%'||old.id::text||'%';
  delete from private.outbox where topic like '%'||old.id::text||'%' or event_key like '%'||old.id::text||'%'
    or safe_payload::text like '%'||old.id::text||'%';
  delete from public.profiles where id=old.id;
  delete from private.account_erasure_context where user_id=old.id;
  return old;
end;
$$;
revoke all on function private.erase_auth_user_data() from public,anon,authenticated,service_role;
create trigger scholau_erase_auth_user_data before delete on auth.users
  for each row execute function private.erase_auth_user_data();

create or replace function public.get_my_battles_v1(p_before timestamptz default null, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
begin
  select coalesce(jsonb_agg(x.item order by x.joined_at desc), '[]'::jsonb) into v_items
  from (
    select bp.joined_at, jsonb_build_object(
      'battle_id', b.id,
      'mode', b.mode,
      'state', b.state,
      'result_kind', b.result_kind,
      'cancel_reason', b.cancel_reason,
      'course', jsonb_build_object('code', c.code, 'title', c.title),
      'opponent', coalesce((select jsonb_build_object('display_name', p.display_name, 'avatar_path', p.avatar_path)
                   from public.battle_participants op join public.profiles p on p.id = op.user_id
                   where op.battle_id = b.id and op.user_id <> v_uid),
                   case when b.created_by is null or b.state in ('finished','voided') then jsonb_build_object('display_name','Deleted user','avatar_path',null) end),
      'my_correct', case when b.state in ('finished', 'voided') then bp.correct_count end,
      'opponent_correct', case when b.state in ('finished', 'voided') then
                            (select op.correct_count from public.battle_participants op where op.battle_id = b.id and op.user_id <> v_uid) end,
      'outcome', case when b.state = 'finished' then
                        case when b.result_kind = 'draw' then 'draw' when b.winner_user_id = v_uid then 'win' else 'loss' end
                      when b.state = 'voided' then 'voided'
                      when b.state = 'cancelled' then 'cancelled'
                      else 'in_progress' end,
      'xp_awarded', coalesce((select sum(l.amount) from public.points_ledger l where l.user_id = v_uid and l.source_id = b.id), 0),
      'round_count', b.round_count,
      'created_at', b.created_at,
      'finalized_at', b.finalized_at,
      'joined_at', bp.joined_at) as item
    from public.battle_participants bp
    join public.battles b on b.id = bp.battle_id
    join public.course_offerings o on o.id = b.offering_id
    join public.courses c on c.id = o.course_id
    where bp.user_id = v_uid and (p_before is null or bp.joined_at < p_before)
    order by bp.joined_at desc
    limit v_limit
  ) x;

  return private.envelope(jsonb_build_object(
    'items', v_items,
    'next_before', case when jsonb_array_length(v_items) = v_limit
                        then v_items -> (v_limit - 1) ->> 'joined_at' end));
end;
$$;
