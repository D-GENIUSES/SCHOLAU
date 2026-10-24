-- Fill-in-gap answers added a fifth argument with a default, which left the original
-- four-argument submit_battle_answer_v1 in place. Multiple-choice clients send
-- p_text_answer as null, and PostgREST cannot type a null against two overloads, so
-- the call returns 300 and the answer is never stored.
-- New functions also do not receive execute grants from default privileges.

drop function if exists public.submit_battle_answer_v1(uuid, integer, uuid, uuid);

revoke all on function public.submit_battle_answer_v1(uuid, integer, uuid, uuid, text) from public, anon;
grant execute on function public.submit_battle_answer_v1(uuid, integer, uuid, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
