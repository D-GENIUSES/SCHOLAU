begin;

create or replace function private.finalize_admin_created_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := new.raw_app_meta_data->'scholau_provision';
  actor uuid;
  account_role text;
  req uuid;
  pending private.admin_created_accounts%rowtype;
  offerings uuid[];
  available integer;
begin
  if m is null or new.email_confirmed_at is null then return new; end if;
  select * into pending from private.admin_created_accounts where user_id = new.id for update;
  if found and pending.finalized then return new; end if;
  if pending.user_id is null or pending.creation_transaction is distinct from txid_current() then
    perform private.raise_error('FORBIDDEN', 'Managed accounts must be provisioned during creation.');
  end if;
  actor := (m->>'actor_id')::uuid;
  account_role := m->>'role';
  req := (m->>'request_key')::uuid;
  if actor is null or not private.user_is_admin(actor) then
    perform private.raise_error('FORBIDDEN', 'Active administrator required.');
  end if;
  if account_role is null or account_role not in ('student', 'lecturer') or account_role <> pending.role or req is null then
    perform private.raise_error('VALIDATION_FAILED', 'Invalid managed account details.');
  end if;

  -- The previous web deployment omits this field and still assigns courses through its RPC.
  -- The new route always supplies it for lecturers, after checking the capability below.
  if m ? 'offering_ids' then
    if account_role <> 'lecturer' or jsonb_typeof(m->'offering_ids') is distinct from 'array' then
      perform private.raise_error('VALIDATION_FAILED', 'Invalid teaching assignments.');
    end if;
    if jsonb_array_length(m->'offering_ids') not between 1 and 100 then
      perform private.raise_error('VALIDATION_FAILED', 'Select at least one published course.');
    end if;
    select array_agg(distinct id::uuid order by id::uuid) into offerings
    from jsonb_array_elements_text(m->'offering_ids') as selected(id);
    perform 1 from public.course_offerings o
    where o.id = any(offerings) and o.status = 'published'
    order by o.id for share;
    get diagnostics available = row_count;
    if available <> cardinality(offerings) then
      perform private.raise_error('VALIDATION_FAILED', 'Choose published course offerings.');
    end if;
  end if;

  update private.admin_created_accounts set created_by = actor, request_key = req, finalized = true
  where user_id = new.id;
  insert into public.user_roles(user_id, role) values (new.id, account_role);
  if offerings is not null then
    insert into public.lecturer_course_assignments(user_id, offering_id, assigned_by)
    select new.id, id, actor from unnest(offerings) as selected(id);
    perform private.audit(actor, 'set_user_courses', 'profile', new.id, req, null,
      jsonb_build_object('offering_ids', to_jsonb(offerings)));
  end if;
  perform private.audit(actor, 'create_user', 'profile', new.id, req, null, jsonb_build_object('role', account_role));
  return new;
end $$;

create or replace function public.admin_user_creation_access_v1() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object('actor_id', private.require_admin(), 'atomic_lecturer_provisioning', true);
end $$;

create function public.admin_provision_welcome_recipient_v1(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('email', u.email, 'display_name', p.display_name)
  from private.admin_created_accounts m
  join auth.users u on u.id = m.user_id
  join public.profiles p on p.id = m.user_id
  join public.user_roles r on r.user_id = m.user_id and r.role = 'lecturer'
  where m.user_id = p_user_id and m.role = 'lecturer' and m.finalized
    and p.deactivated_at is null and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and u.email_confirmed_at is not null and nullif(btrim(u.email), '') is not null;
$$;

revoke all on function public.admin_provision_welcome_recipient_v1(uuid) from public, anon, authenticated;
grant execute on function public.admin_provision_welcome_recipient_v1(uuid) to service_role;

commit;
