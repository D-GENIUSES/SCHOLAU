-- Preserve account-erasure behaviour after learning-loop tables and student videos are added.
-- All of these relations contain attribution, not immutable learning evidence owned by the author.
-- Student-owned pending sources are erased with the student; approved learning artifacts retain attribution-free content.

alter table private.student_material_submissions
  drop constraint if exists student_material_submissions_student_id_fkey;
alter table private.student_material_submissions
  add constraint student_material_submissions_student_id_fkey
  foreign key(student_id) references public.profiles(id) on delete cascade;

alter table private.student_material_submissions
  drop constraint if exists student_material_submissions_reviewed_by_fkey;
alter table private.student_material_submissions
  add constraint student_material_submissions_reviewed_by_fkey
  foreign key(reviewed_by) references public.profiles(id) on delete set null;

alter table private.practice_question_hints
  alter column approved_by drop not null;
alter table private.practice_question_hints
  drop constraint if exists practice_question_hints_approved_by_fkey;
alter table private.practice_question_hints
  add constraint practice_question_hints_approved_by_fkey
  foreign key(approved_by) references public.profiles(id) on delete set null;

alter table private.light_course_assignments
  alter column created_by drop not null;
alter table private.light_course_assignments
  drop constraint if exists light_course_assignments_created_by_fkey;
alter table private.light_course_assignments
  add constraint light_course_assignments_created_by_fkey
  foreign key(created_by) references public.profiles(id) on delete set null;

alter table public.lesson_videos
  alter column submitted_by drop not null;
alter table public.lesson_videos
  drop constraint if exists lesson_videos_submitted_by_fkey;
alter table public.lesson_videos
  add constraint lesson_videos_submitted_by_fkey
  foreign key(submitted_by) references public.profiles(id) on delete set null;
alter table public.lesson_videos
  drop constraint if exists lesson_videos_reviewed_by_fkey;
alter table public.lesson_videos
  add constraint lesson_videos_reviewed_by_fkey
  foreign key(reviewed_by) references public.profiles(id) on delete set null;
