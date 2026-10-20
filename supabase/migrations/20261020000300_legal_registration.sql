-- Install before releasing the matching web forms. Existing accounts are unchanged.
-- No production configuration, accounts or consent approvals are created here.
begin;
create table private.legal_settings (
  singleton boolean primary key default true check(singleton),
  terms_version text not null,
  privacy_version text not null,
  published boolean not null default false,
  guardian_enabled boolean not null default false,
  operator_name text,
  operator_address text,
  support_email text,
  operations_verified boolean not null default false
);
insert into private.legal_settings(singleton,terms_version,privacy_version)
values(true,'2026-10-19-draft-1','2026-10-19-draft-1');

create table private.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  applicant_email text not null check(applicant_email=lower(btrim(applicant_email)) and length(applicant_email) between 3 and 320),
  guardian_name text not null check(length(btrim(guardian_name)) between 2 and 200),
  guardian_email text not null check(length(guardian_email) between 3 and 320),
  relationship text not null check(length(btrim(relationship)) between 2 and 100),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  terms_version text not null,
  privacy_version text not null,
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references auth.users(id) on delete set null,
  consent_received_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verification_note text check(length(verification_note)<=2000),
  expires_at timestamptz not null,
  user_id uuid unique references auth.users(id) on delete cascade,
  consumed_at timestamptz,
  check(status<>'approved' or (consent_received_at is not null and verified_at is not null and verification_note is not null)),
  check((user_id is null)=(consumed_at is null))
);
create index guardian_consents_applicant on private.guardian_consents(applicant_email);

create table private.legal_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default clock_timestamp(),
  age_declaration text not null check(age_declaration in ('adult','under18')),
  guardian_consent_id uuid references private.guardian_consents(id),
  check((age_declaration='under18')=(guardian_consent_id is not null))
);
alter table private.legal_settings enable row level security;
alter table private.guardian_consents enable row level security;
alter table private.legal_acceptances enable row level security;
revoke all on private.legal_settings,private.guardian_consents,private.legal_acceptances from public,anon,authenticated,service_role;

create function private.guardian_registration_ready() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select published and guardian_enabled and operations_verified
    and terms_version not like '%draft%' and privacy_version not like '%draft%'
    and length(btrim(operator_name))>1 and operator_name not like '%[%'
    and length(btrim(operator_address))>5 and operator_address not like '%[%'
    and support_email ~ '^[^[:space:]@\[\]]+@[^[:space:]@\[\]]+\.[^[:space:]@\[\]]+$'
    from private.legal_settings where singleton),false)
$$;

create function public.get_registration_legal_status_v1() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('terms_version',terms_version,'privacy_version',privacy_version,
    'guardian_enabled',private.guardian_registration_ready(),
    'support_email',case when private.guardian_registration_ready() then support_email else null end)
  from private.legal_settings where singleton
$$;

-- Auth INSERT runs atomically: rejection rolls back auth user, profile and all roles.
-- Deliberately applies to every new account, including managed/provisioned accounts.
-- A client-supplied signup_kind cannot bypass legal eligibility.
create function private.capture_registration_legal() returns trigger
language plpgsql security definer set search_path='' as $$
declare s private.legal_settings%rowtype; g private.guardian_consents%rowtype;
  m jsonb:=coalesce(new.raw_user_meta_data,'{}'::jsonb); age text; approval uuid;
begin
  select * into s from private.legal_settings where singleton;
  age:=m->>'age_declaration';
  if s.singleton is null or m->'terms_accepted' is distinct from 'true'::jsonb
    or m->>'terms_version' is distinct from s.terms_version
    or m->>'privacy_version' is distinct from s.privacy_version
    or age is null or age not in ('adult','under18') then
    raise exception using errcode='P0001',message='LEGAL_ACCEPTANCE_REQUIRED';
  end if;
  if age='under18' then
    if not private.guardian_registration_ready() then
      raise exception using errcode='P0001',message='GUARDIAN_REGISTRATION_CLOSED';
    end if;
    begin approval:=(m->>'guardian_approval')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode='P0001',message='GUARDIAN_APPROVAL_REQUIRED';
    end;
    select * into g from private.guardian_consents where id=approval for update;
    if g.id is null or g.status<>'approved' or g.user_id is not null
      or g.expires_at<=clock_timestamp() or g.applicant_email is distinct from lower(btrim(new.email))
      or g.terms_version<>s.terms_version or g.privacy_version<>s.privacy_version then
      raise exception using errcode='P0001',message='GUARDIAN_APPROVAL_REQUIRED';
    end if;
    update private.guardian_consents set user_id=new.id,consumed_at=clock_timestamp() where id=g.id;
  end if;
  insert into private.legal_acceptances(user_id,terms_version,privacy_version,age_declaration,guardian_consent_id)
    values(new.id,s.terms_version,s.privacy_version,age,case when age='under18' then g.id else null end);
  return new;
end $$;
create trigger zz_capture_registration_legal after insert on auth.users
for each row execute function private.capture_registration_legal();

-- Manual support workflow. These RPCs never create an Auth account or accept a
-- client assertion of guardian verification. Only active administrators can use them.
create function public.admin_create_guardian_request_v1(
  p_applicant_email text,p_guardian_name text,p_guardian_email text,p_relationship text,p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_user(); result uuid; s private.legal_settings%rowtype;
begin
  if not private.user_is_admin(actor) then raise exception using errcode='42501',message='Active administrator required'; end if;
  if p_applicant_email is null or p_applicant_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_guardian_email is null or p_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_expires_at is null or p_expires_at<=clock_timestamp() then
    raise exception using errcode='22023',message='Valid applicant and guardian emails and a future expiry are required';
  end if;
  select * into strict s from private.legal_settings where singleton;
  insert into private.guardian_consents(applicant_email,guardian_name,guardian_email,relationship,expires_at,created_by,terms_version,privacy_version)
    values(lower(btrim(p_applicant_email)),btrim(p_guardian_name),lower(btrim(p_guardian_email)),btrim(p_relationship),p_expires_at,actor,s.terms_version,s.privacy_version)
    returning id into result;
  return result;
end $$;

create function public.admin_review_guardian_request_v1(
  p_request_id uuid,p_approve boolean,p_consent_received_at timestamptz,p_verification_note text,p_authority_verified boolean
) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_user(); g private.guardian_consents%rowtype; s private.legal_settings%rowtype;
begin
  if not private.user_is_admin(actor) then raise exception using errcode='42501',message='Active administrator required'; end if;
  select * into g from private.guardian_consents where id=p_request_id for update;
  if g.id is null or g.user_id is not null or g.status<>'pending' then
    raise exception using errcode='22023',message='An unconsumed pending request is required';
  end if;
  select * into strict s from private.legal_settings where singleton;
  if p_approve is null or length(btrim(coalesce(p_verification_note,''))) not between 10 and 2000 then
    raise exception using errcode='22023',message='A review decision and verification note are required';
  end if;
  if p_approve and (not private.guardian_registration_ready() or p_authority_verified is distinct from true
    or p_consent_received_at is null or p_consent_received_at>clock_timestamp() or g.expires_at<=clock_timestamp()
    or g.terms_version<>s.terms_version or g.privacy_version<>s.privacy_version) then
    raise exception using errcode='22023',message='Operational support, verified authority and current consent are required';
  end if;
  update private.guardian_consents set status=case when p_approve then 'approved' else 'rejected' end,
    consent_received_at=p_consent_received_at,verified_at=clock_timestamp(),verified_by=actor,
    verification_note=btrim(p_verification_note) where id=g.id;
end $$;

create function public.admin_list_guardian_requests_v1() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_user(); result jsonb;
begin
  if not private.user_is_admin(actor) then raise exception using errcode='42501',message='Active administrator required'; end if;
  select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into result
    from (select * from private.guardian_consents order by created_at desc limit 100) g;
  return result;
end $$;

-- Remove both FK-linked records in a defined order before other erasure triggers.
create function private.erase_legal_records() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  delete from private.legal_acceptances where user_id=old.id;
  delete from private.guardian_consents where user_id=old.id or applicant_email=lower(btrim(old.email));
  return old;
end $$;
create trigger aa_erase_legal_records before delete on auth.users
for each row execute function private.erase_legal_records();

revoke all on function private.guardian_registration_ready(),private.capture_registration_legal(),private.erase_legal_records() from public,anon,authenticated,service_role;
revoke all on function public.get_registration_legal_status_v1() from public;
grant execute on function public.get_registration_legal_status_v1() to anon,authenticated;
revoke all on function public.admin_create_guardian_request_v1(text,text,text,text,timestamptz),public.admin_review_guardian_request_v1(uuid,boolean,timestamptz,text,boolean),public.admin_list_guardian_requests_v1() from public,anon,service_role;
grant execute on function public.admin_create_guardian_request_v1(text,text,text,text,timestamptz),public.admin_review_guardian_request_v1(uuid,boolean,timestamptz,text,boolean),public.admin_list_guardian_requests_v1() to authenticated;
commit;
