-- Structural security invariants: RLS everywhere, no client mutation grants, private schema hidden,
-- internal function grants, SECURITY DEFINER hygiene.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and n.nspname in ('public', 'private') and not c.relrowsecurity),
  0, 'RLS is enabled on every table in public and private');

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and n.nspname = 'public'),
  46, 'public schema includes lecturer applications, course assignments and social battles');

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and n.nspname = 'private'),
  25, 'private schema includes confidential reviews, managed accounts, profile photos and push delivery');

select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon has no usage on private');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated has no usage on private');

select is(
  (select count(*)::integer
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   cross join (values ('anon'), ('authenticated')) r(role)
   cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
   where c.relkind in ('r', 'p') and n.nspname in ('public', 'private')
     and has_table_privilege(r.role, c.oid, p.priv)),
  0, 'anon/authenticated have no INSERT/UPDATE/DELETE/TRUNCATE on any application table');

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and n.nspname = 'public' and has_table_privilege('anon', c.oid, 'SELECT')
     and c.relname not in ('universities', 'faculties', 'departments', 'levels', 'academic_periods', 'semesters', 'app_config')),
  0, 'anon can only read the onboarding hierarchy and app_config');

select ok(not has_table_privilege('authenticated', 'public.attempt_answers', 'SELECT'), 'attempt_answers is RPC-only');
select ok(not has_table_privilege('authenticated', 'public.attempt_questions', 'SELECT'), 'attempt_questions is RPC-only');
select ok(not has_table_privilege('authenticated', 'public.battle_questions', 'SELECT'), 'battle_questions is RPC-only');
select ok(not has_table_privilege('authenticated', 'public.battle_answers', 'SELECT'), 'battle_answers is RPC-only');

-- Internal functions: no execute for API roles.
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   cross join (values ('anon'), ('authenticated')) r(role)
   where n.nspname = 'private' and has_function_privilege(r.role, p.oid, 'EXECUTE')),
  0, 'no private function is executable by anon/authenticated');

select ok(not has_function_privilege('authenticated', 'private.award_points(uuid,text,text,uuid,text,integer,timestamptz)', 'EXECUTE'),
  'award_points is internal-only');
select ok(not has_function_privilege('authenticated', 'private.finalize_attempt(uuid,text)', 'EXECUTE'), 'finalize_attempt is internal-only');
select ok(not has_function_privilege('authenticated', 'private.advance_battle(uuid)', 'EXECUTE'), 'advance_battle is internal-only');
select ok(not has_function_privilege('authenticated', 'private.finalize_battle(uuid)', 'EXECUTE'), 'finalize_battle is internal-only');
select ok(not has_function_privilege('authenticated', 'private.reconcile_reservations()', 'EXECUTE'), 'reconcile_reservations is internal-only');
select ok(not has_function_privilege('authenticated', 'private.dispatch_outbox(integer)', 'EXECUTE'), 'dispatch_outbox is internal-only');
select ok(not has_function_privilege('authenticated',
  'private.verified_entitlement_upsert(text,text,text,uuid,text,timestamptz,timestamptz,boolean)', 'EXECUTE'),
  'verified_entitlement_upsert is internal-only');

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname like '%\_v1'),
  0, 'anon cannot execute any public RPC');

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.proname not like '%\_v1'),
  0, 'authenticated can execute only *_v1 RPCs in public');

select ok(has_function_privilege('authenticated', 'public.submit_attempt_v1(uuid,jsonb,uuid)', 'EXECUTE'),
  'authenticated can execute public RPCs');

-- Every SECURITY DEFINER function pins an empty search_path.
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private', 'authz') and p.prosecdef
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  0, 'all SECURITY DEFINER functions set search_path = ''''');

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like '%\_v1' and not p.prosecdef),
  0, 'all public RPCs are SECURITY DEFINER with explicit checks');

select ok(exists (select 1 from pg_trigger where tgname = 'on_auth_user_created'), 'auth.users insert trigger exists');

select * from finish();
rollback;
