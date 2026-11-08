alter table private.announcements
  add column status text not null default 'published' check (status in ('scheduled','published','cancelled','failed')),
  add column scheduled_at timestamptz,
  add column published_at timestamptz,
  add column failure_reason text,
  add column revision integer not null default 1,
  add constraint scheduled_announcement_has_date check (status <> 'scheduled' or scheduled_at is not null);

create index announcements_due on private.announcements (scheduled_at, id) where status = 'scheduled';
create index announcements_lecturer_history on private.announcements (author_id, created_at desc, id desc)
  where audience = 'offering';

create function private.can_announce_as_lecturer(p_user uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    join public.profiles p on p.id = r.user_id
    join auth.users u on u.id = r.user_id
    where r.user_id = p_user and r.role = 'lecturer'
      and p.deactivated_at is null and u.email_confirmed_at is not null
      and not exists (select 1 from private.pending_registrations pr where pr.user_id = p_user)
      and (
        exists (select 1 from private.admin_created_accounts m where m.user_id = p_user and m.role = 'lecturer' and m.finalized)
        or exists (select 1 from public.lecturer_applications a where a.user_id = p_user and a.status = 'approved')
      )
  );
$$;

create function private.can_announce_to_class(p_user uuid, p_offering uuid)
returns boolean language sql stable set search_path = '' as $$
  select private.can_announce_as_lecturer(p_user) and exists (
    select 1 from public.lecturer_course_assignments a
    join public.course_offerings o on o.id = a.offering_id
    where a.user_id = p_user and a.offering_id = p_offering and o.status = 'published'
  );
$$;

create function private.class_announcement_students(p_offering uuid)
returns setof uuid language sql stable set search_path = '' as $$
  select distinct e.user_id
  from public.enrollments e
  join public.profiles p on p.id = e.user_id
  join public.user_roles r on r.user_id = e.user_id and r.role = 'student'
  where e.offering_id = p_offering and e.ended_at is null and p.deactivated_at is null
    and not exists (select 1 from private.pending_registrations pr where pr.user_id = e.user_id);
$$;

-- Keep the existing announcement APIs compatible while closing the lecturer eligibility gap.
create or replace function private.announcement_recipients(p_actor uuid, p_audience text, p_id text)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  admin boolean := exists (select 1 from public.user_roles where user_id = p_actor and role = 'admin');
  offering uuid;
begin
  if p_audience is null or p_audience not in ('offering','role','everyone') then
    perform private.raise_error('VALIDATION_FAILED');
  end if;
  if not admin and (p_audience <> 'offering' or not private.can_announce_as_lecturer(p_actor)) then
    perform private.raise_error('FORBIDDEN');
  end if;
  if p_audience = 'offering' then
    if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      perform private.raise_error('VALIDATION_FAILED');
    end if;
    offering := p_id::uuid;
    if not exists (select 1 from public.course_offerings where id = offering and status = 'published') then
      perform private.raise_error('VALIDATION_FAILED');
    end if;
    if admin then
      return query select e.user_id from public.enrollments e join public.profiles p on p.id = e.user_id
        where e.offering_id = offering and e.ended_at is null and p.deactivated_at is null;
    else
      if not private.can_announce_to_class(p_actor, offering) then perform private.raise_error('FORBIDDEN'); end if;
      return query select * from private.class_announcement_students(offering);
    end if;
  elsif p_audience = 'role' then
    if p_id is null or p_id not in ('student','lecturer','admin') then perform private.raise_error('VALIDATION_FAILED'); end if;
    return query select r.user_id from public.user_roles r join public.profiles p on p.id = r.user_id
      where r.role = p_id and p.deactivated_at is null;
  else
    return query select id from public.profiles where deactivated_at is null;
  end if;
end;
$$;

create or replace function public.get_announcement_audiences_v1()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  admin boolean := exists (select 1 from public.user_roles where user_id = actor and role = 'admin');
begin
  if not admin and not private.can_announce_as_lecturer(actor) then perform private.raise_error('FORBIDDEN'); end if;
  return private.envelope(jsonb_build_object('offerings', coalesce((
    select jsonb_agg(jsonb_build_object('id', o.id,
      'label', c.code || ' — ' || c.title || ' · ' || d.name || ' · ' || s.label || ' · ' || ap.label) order by c.code, o.id)
    from public.course_offerings o
    join public.courses c on c.id = o.course_id
    join public.departments d on d.id = o.department_id
    join public.semesters s on s.id = o.semester_id
    join public.academic_periods ap on ap.id = s.academic_period_id
    where o.status = 'published' and (admin or exists (
      select 1 from public.lecturer_course_assignments a where a.user_id = actor and a.offering_id = o.id
    ))
  ), '[]'::jsonb)));
end;
$$;

-- The caller holds the announcement row lock. Fan-out and state change commit together.
create function private.publish_lecturer_announcement(p_post private.announcements)
returns private.announcements language plpgsql set search_path = '' as $$
declare
  offering uuid := p_post.audience_id::uuid;
  sent integer := 0;
  reason text;
  result private.announcements;
begin
  if not private.can_announce_to_class(p_post.author_id, offering) then
    reason := 'You no longer have access to publish to this class.';
  else
    insert into private.notification_recipients(event_key,user_id,kind,title,body,target,category,context)
    select 'announcement:' || p_post.id, student, 'announcement', p_post.title, p_post.body, p_post.target,
      'announcement', jsonb_build_object('audience','offering','audience_id',offering)
    from private.class_announcement_students(offering) student
    on conflict (event_key, user_id) do nothing;
    get diagnostics sent = row_count;
    if sent = 0 then reason := 'No active students were enrolled at publish time.'; end if;
  end if;

  update private.announcements
  set status = case when reason is null then 'published' else 'failed' end,
      published_at = case when reason is null then now() end,
      recipient_count = sent, failure_reason = reason, revision = revision + 1
  where id = p_post.id
  returning * into result;

  if reason is null then
    perform private.audit(p_post.author_id, 'send_announcement', 'announcement', p_post.id,
      p_post.request_key, null, jsonb_build_object('recipient_count', sent, 'audience', 'offering'));
  end if;
  return result;
end;
$$;

create function private.lecturer_announcement_json(p_post private.announcements)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', p_post.id, 'offering_id', p_post.audience_id,
    'title', p_post.title, 'body', p_post.body, 'status', p_post.status,
    'scheduled_at', p_post.scheduled_at, 'created_at', p_post.created_at,
    'published_at', case when p_post.status = 'published' then coalesce(p_post.published_at, p_post.created_at) end,
    'recipient_count', p_post.recipient_count, 'failure_reason', p_post.failure_reason, 'revision', p_post.revision);
$$;

create function public.preview_lecturer_announcement_v1(p_offering_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_user();
begin
  if not private.can_announce_to_class(actor, p_offering_id) then perform private.raise_error('FORBIDDEN'); end if;
  return jsonb_build_object('recipient_count', (select count(*) from private.class_announcement_students(p_offering_id)));
end;
$$;

create function public.list_lecturer_announcements_v1(p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := private.require_user();
begin
  if not private.can_announce_as_lecturer(actor) then perform private.raise_error('FORBIDDEN'); end if;
  return jsonb_build_object('items', coalesce((
    select jsonb_agg(private.lecturer_announcement_json(a) || jsonb_build_object('course_label', (
      select c.code || ' · ' || c.title || ' · ' || s.label
      from public.course_offerings o join public.courses c on c.id = o.course_id
      join public.semesters s on s.id = o.semester_id where o.id = a.audience_id::uuid
    )) order by a.created_at desc, a.id desc)
    from (
      select * from private.announcements
      where author_id = actor and audience = 'offering'
      order by created_at desc, id desc limit 21 offset greatest(p_offset, 0)
    ) a
  ), '[]'::jsonb));
end;
$$;

create function public.save_lecturer_announcement_v1(
  p_offering_id uuid, p_title text, p_body text, p_scheduled_at timestamptz, p_request_key uuid,
  p_id uuid default null, p_revision integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  post private.announcements;
  title_value text := btrim(coalesce(p_title, ''));
  body_value text := btrim(coalesce(p_body, ''));
begin
  if not private.can_announce_to_class(actor, p_offering_id) then perform private.raise_error('FORBIDDEN'); end if;
  perform private.require_request_key(p_request_key);
  perform pg_advisory_xact_lock(hashtextextended('announcement:' || actor, 0));

  if p_id is null then
    select * into post from private.announcements where author_id = actor and request_key = p_request_key;
    if found then
      if post.audience <> 'offering' or post.audience_id is distinct from p_offering_id::text
         or post.title <> title_value or post.body <> body_value
         or post.scheduled_at is distinct from p_scheduled_at then
        perform private.raise_error('VALIDATION_FAILED', 'Request key already used.');
      end if;
      return private.lecturer_announcement_json(post);
    end if;
  else
    select * into post from private.announcements where id = p_id and author_id = actor and audience = 'offering' for update;
    if not found then perform private.raise_error('NOT_FOUND'); end if;
    if post.status <> 'scheduled' or post.revision is distinct from p_revision then
      perform private.raise_error('STALE_REVISION', 'This announcement has changed. Refresh it before editing.');
    end if;
  end if;

  if length(title_value) not between 1 and 100 or length(body_value) not between 1 and 500 then
    perform private.raise_error('VALIDATION_FAILED', 'Enter a title and message within the character limits.');
  end if;
  if p_scheduled_at is not null and (not isfinite(p_scheduled_at) or p_scheduled_at <= now()) then
    perform private.raise_error('VALIDATION_FAILED', 'Choose a publish time in the future.');
  end if;
  if p_id is null then
    if (select count(*) from private.announcements where author_id = actor and created_at > now() - interval '1 hour')
      >= (select announcement_hourly_limit from private.push_control) then
      perform private.raise_error('RATE_LIMITED');
    end if;
    insert into private.announcements(author_id, request_key, title, body, target, audience, audience_id, status, scheduled_at)
    values(actor, p_request_key, title_value, body_value, '/study/courses/' || p_offering_id,
      'offering', p_offering_id::text, 'scheduled', coalesce(p_scheduled_at, now()))
    returning * into post;
  else
    update private.announcements set title = title_value, body = body_value,
      target = '/study/courses/' || p_offering_id, audience_id = p_offering_id::text,
      scheduled_at = coalesce(p_scheduled_at, now()), revision = revision + 1
    where id = post.id returning * into post;
  end if;

  if p_scheduled_at is null then
    post := private.publish_lecturer_announcement(post);
    update private.announcements set scheduled_at = null where id = post.id returning * into post;
  end if;
  return private.lecturer_announcement_json(post);
end;
$$;

create function public.cancel_lecturer_announcement_v1(p_id uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  post private.announcements;
begin
  if not private.can_announce_as_lecturer(actor) then perform private.raise_error('FORBIDDEN'); end if;
  update private.announcements set status = 'cancelled', revision = revision + 1
  where id = p_id and author_id = actor and status = 'scheduled' and revision = p_revision
  returning * into post;
  if not found then perform private.raise_error('STALE_REVISION', 'This announcement has changed. Refresh to see its status.'); end if;
  return private.lecturer_announcement_json(post);
end;
$$;

create function private.publish_due_lecturer_announcements()
returns void language plpgsql set search_path = '' as $$
declare post private.announcements;
begin
  for post in select * from private.announcements where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at, id limit 20 for update skip locked
  loop
    begin
      perform private.publish_lecturer_announcement(post);
    exception when others then
      -- An unexpected delivery error rolls back this post's fan-out.
      update private.announcements set status = 'failed', revision = revision + 1,
        failure_reason = 'Delivery could not be completed.' where id = post.id;
      raise warning 'Scheduled announcement % failed with SQLSTATE %', post.id, sqlstate;
    end;
  end loop;
end;
$$;

revoke all on function private.can_announce_as_lecturer(uuid), private.can_announce_to_class(uuid, uuid),
  private.class_announcement_students(uuid), private.publish_lecturer_announcement(private.announcements),
  private.lecturer_announcement_json(private.announcements), private.publish_due_lecturer_announcements()
  from public, anon, authenticated;

revoke all on function public.preview_lecturer_announcement_v1(uuid), public.list_lecturer_announcements_v1(integer),
  public.save_lecturer_announcement_v1(uuid, text, text, timestamptz, uuid, uuid, integer),
  public.cancel_lecturer_announcement_v1(uuid, integer) from public, anon, authenticated;
grant execute on function public.preview_lecturer_announcement_v1(uuid), public.list_lecturer_announcements_v1(integer),
  public.save_lecturer_announcement_v1(uuid, text, text, timestamptz, uuid, uuid, integer),
  public.cancel_lecturer_announcement_v1(uuid, integer) to authenticated;

select cron.schedule('scholau-lecturer-announcements', '* * * * *', $$select private.publish_due_lecturer_announcements()$$);
