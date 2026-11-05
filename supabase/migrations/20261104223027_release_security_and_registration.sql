-- Close gaps found by the clean-database security audit.
-- These tables are accessed through checked SECURITY DEFINER functions only.
begin;
alter table private.daily_question_history enable row level security;
alter table private.elective_selection_rules enable row level security;
revoke all on private.daily_question_history, private.elective_selection_rules
  from public, anon, authenticated;

revoke all on function private.normalize_gap_answer(text),
  private.validate_lesson_flashcards(jsonb),
  private.gap_answer_matches(text,jsonb),
  private.queue_welcome_email()
  from public, anon, authenticated;

-- This administrative source lookup must never be granted to anonymous clients.
revoke all on function public.admin_get_course_material_object_v1(uuid,text) from public, anon;
grant execute on function public.admin_get_course_material_object_v1(uuid,text) to authenticated;
commit;
