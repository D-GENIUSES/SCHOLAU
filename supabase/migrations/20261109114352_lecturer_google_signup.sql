alter table private.pending_registrations
  drop constraint pending_registrations_kind_check,
  add constraint pending_registrations_kind_check check (kind in ('google','managed','google_lecturer'));

create function public.begin_google_lecturer_registration_v1() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare applicant uuid := auth.uid();
begin
  if not exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = applicant and u.raw_app_meta_data->>'provider' = 'google'
      and u.email_confirmed_at is not null and p.deactivated_at is null
  ) then perform private.raise_error('FORBIDDEN'); end if;

  update private.pending_registrations set kind = 'google_lecturer'
  where user_id = applicant and kind in ('google','google_lecturer');
  if not found then perform private.raise_error('INVALID_STATE', 'This account has already completed registration.'); end if;
  return jsonb_build_object('pending', true);
end;
$$;

create or replace function public.get_my_registration_status_v1() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare applicant uuid := auth.uid(); registration text;
begin
  if applicant is null or not exists (select 1 from public.profiles where id = applicant and deactivated_at is null) then
    perform private.raise_error('UNAUTHENTICATED');
  end if;
  select kind into registration from private.pending_registrations where user_id = applicant;
  return jsonb_build_object('pending', registration is not null, 'lecturer', coalesce(registration = 'google_lecturer', false));
end;
$$;

create or replace function public.complete_registration_v1(p_metadata jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); account_email text; pending private.pending_registrations%rowtype;
begin
  select u.email into account_email from auth.users u join public.profiles p on p.id = u.id
    where u.id = uid and u.email_confirmed_at is not null and p.deactivated_at is null;
  if account_email is null then perform private.raise_error('UNAUTHENTICATED'); end if;
  select * into pending from private.pending_registrations where user_id = uid for update;
  if not found then
    if exists (select 1 from private.legal_acceptances where user_id = uid) then return jsonb_build_object('completed',true); end if;
    perform private.raise_error('INVALID_STATE','This account does not have a pending registration.');
  end if;
  if pending.kind = 'google_lecturer' then
    perform private.raise_error('INVALID_STATE','Submit your teaching details to finish the lecturer application.');
  end if;
  if jsonb_typeof(p_metadata) is distinct from 'object' or octet_length(p_metadata::text) > 2048 then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  perform private.record_registration_legal(uid, account_email, p_metadata);
  update public.profiles set leaderboard_visible = pending.leaderboard_visible where id = uid;
  delete from private.pending_registrations where user_id = uid;
  return jsonb_build_object('completed',true);
end;
$$;

-- Only the application transaction can meet these conditions while the account is pending.
create or replace function private.guard_lecturer_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.registration_kind <> old.registration_kind and not (
    old.registration_kind = 'student' and new.registration_kind = 'lecturer_applicant'
    and exists (select 1 from private.pending_registrations where user_id = old.id and kind = 'google_lecturer')
    and exists (select 1 from public.lecturer_applications where user_id = old.id and status = 'pending')
    and not exists (select 1 from public.user_roles where user_id = old.id and role = 'student')
  ) then perform private.raise_error('FORBIDDEN','Registration type cannot be changed.'); end if;
  if new.registration_kind = 'lecturer_applicant' then
    new.leaderboard_visible := false;
    if new.university_id is not null or new.faculty_id is not null or new.department_id is not null
      or new.level_id is not null or new.academic_period_id is not null or new.semester_id is not null then
      perform private.raise_error('FORBIDDEN','Lecturer accounts use teaching assignments, not student enrollment.');
    end if;
  end if;
  return new;
end;
$$;

create function public.complete_google_lecturer_registration_v1(p_application jsonb, p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare applicant uuid := auth.uid(); account_email text; registration text; application_id uuid;
begin
  select u.email into account_email from auth.users u join public.profiles p on p.id = u.id
  where u.id = applicant and u.raw_app_meta_data->>'provider' = 'google'
    and u.email_confirmed_at is not null and p.deactivated_at is null;
  if account_email is null then perform private.raise_error('FORBIDDEN'); end if;

  select kind into registration from private.pending_registrations where user_id = applicant for update;
  if not found then
    select id into application_id from public.lecturer_applications where user_id = applicant;
    if found then return jsonb_build_object('application_id', application_id); end if;
    perform private.raise_error('INVALID_STATE', 'This account has already completed registration.');
  end if;
  if registration <> 'google_lecturer' then perform private.raise_error('FORBIDDEN'); end if;
  if jsonb_typeof(p_metadata) is distinct from 'object' or octet_length(p_metadata::text) > 2048
    or octet_length(p_application::text) > 24000 then perform private.raise_error('VALIDATION_FAILED'); end if;
  perform private.validate_lecturer_application(p_application);

  insert into public.lecturer_applications(user_id,full_name,university,faculty,department,position,requested_courses,institutional_profile_url,verification_note)
  values(applicant, btrim(p_application->>'full_name'), btrim(p_application->>'university'),
    btrim(p_application->>'faculty'), btrim(p_application->>'department'), btrim(p_application->>'position'),
    btrim(p_application->>'requested_courses'), nullif(btrim(p_application->>'institutional_profile_url'),''),
    btrim(coalesce(p_application->>'verification_note','')))
  returning id into application_id;
  delete from public.user_roles where user_id = applicant and role = 'student';
  update public.profiles set registration_kind = 'lecturer_applicant', leaderboard_visible = false,
    display_name = case when strpos(p_application->>'full_name','@') = 0 then left(btrim(p_application->>'full_name'),60) else display_name end
  where id = applicant;
  perform private.record_registration_legal(applicant, account_email, p_metadata);
  delete from private.pending_registrations where user_id = applicant;
  return jsonb_build_object('application_id', application_id);
end;
$$;

revoke all on function public.begin_google_lecturer_registration_v1(),
  public.complete_google_lecturer_registration_v1(jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.begin_google_lecturer_registration_v1(),
  public.complete_google_lecturer_registration_v1(jsonb,jsonb) to authenticated;

create function private.enqueue_registration_welcome(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into private.welcome_email_events(user_id)
  select p.id from public.profiles p
  where p.id = p_user_id and p.deactivated_at is null
    and private.registration_is_visible(p.id)
    and exists (select 1 from private.legal_acceptances where user_id = p.id)
    and (p.registration_kind <> 'lecturer_applicant' or exists (
      select 1 from public.lecturer_applications where user_id = p.id and status = 'approved'
    ))
  on conflict do nothing;
$$;

create or replace function private.queue_welcome_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_registration_welcome(new.user_id);
  return new;
end;
$$;

create or replace function private.finish_verified_email_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.legal_acceptances where user_id = new.id) then
    perform private.enqueue_registration_welcome(new.id);
    perform private.notify_admins_user_registered(new.id);
  end if;
  return new;
end;
$$;

create function private.queue_approved_lecturer_welcome() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_registration_welcome(new.user_id);
  return new;
end;
$$;

create trigger lecturer_approval_queue_welcome after update of status on public.lecturer_applications
for each row when (old.status is distinct from new.status and new.status = 'approved')
execute function private.queue_approved_lecturer_welcome();

revoke all on function private.enqueue_registration_welcome(uuid), private.queue_approved_lecturer_welcome()
  from public, anon, authenticated, service_role;

update public.app_config
set feature_flags = coalesce(feature_flags, '{}'::jsonb) || '{"lecturer_google_signup":true}'::jsonb
where platform = 'web';
