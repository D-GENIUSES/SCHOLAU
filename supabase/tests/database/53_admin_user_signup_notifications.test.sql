begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

select set_config('t.admin', '90000000-0000-4000-8000-000000000002', true);

create function pg_temp.new_student(p_label text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_id,
    replace(p_label, ' ', '-') || '@signup-notify.test',
    now(),
    jsonb_build_object('display_name', p_label)
  );
  return v_id;
end;
$$;

select set_config('t.student', pg_temp.new_student('Signup notify student')::text, true);

select is(
  (select count(*)::int from private.notification_recipients
   where event_key = 'user_registered:' || current_setting('t.student')
     and user_id = current_setting('t.admin')::uuid),
  1,
  'student registration snapshots admin recipients'
);

select public.prepare_push_batch_v1();

select ok(
  exists(
    select 1 from public.notifications
    where user_id = current_setting('t.admin')::uuid
      and kind = 'user_registered'
      and event_key = 'user_registered:' || current_setting('t.student') || ':' || current_setting('t.admin')
  ),
  'admin inbox receives signup notification'
);

create function pg_temp.new_lecturer_applicant() returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_id,
    v_id::text || '@signup-notify-lecturer.test',
    now(),
    jsonb_build_object(
      'display_name', 'Signup notify lecturer',
      'signup_kind', 'lecturer',
      'lecturer_application', jsonb_build_object(
        'full_name', 'Signup notify lecturer',
        'university', 'Test University',
        'faculty', 'Science',
        'department', 'Computing',
        'position', 'Lecturer',
        'requested_courses', 'CSC 101',
        'verification_note', 'Fixture'
      )
    )
  );
  return v_id;
end;
$$;

select set_config('t.lecturer', pg_temp.new_lecturer_applicant()::text, true);

select is(
  (select count(*)::int from private.notification_recipients
   where event_key = 'user_registered:' || current_setting('t.lecturer')),
  0,
  'lecturer applicants rely on application_submitted instead'
);
select ok(
  exists(
    select 1 from private.notification_recipients
    where event_key like 'application_submitted:%'
      and user_id = current_setting('t.admin')::uuid
      and kind = 'application_submitted'
  ),
  'lecturer signup still notifies admins via application queue'
);

select * from finish();
rollback;
