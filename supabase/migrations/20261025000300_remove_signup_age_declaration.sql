-- Sign-up no longer collects age group or guardian approval; record standard adult acceptance.
create or replace function private.record_registration_legal(p_user_id uuid, p_email text, m jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s private.legal_settings%rowtype;
begin
  select * into s from private.legal_settings where singleton;
  if s.singleton is null
    or m->'terms_accepted' is distinct from 'true'::jsonb
    or m->>'terms_version' is distinct from s.terms_version
    or m->>'privacy_version' is distinct from s.privacy_version then
    raise exception using errcode='P0001', message='LEGAL_ACCEPTANCE_REQUIRED';
  end if;
  insert into private.legal_acceptances(user_id, terms_version, privacy_version, age_declaration, guardian_consent_id)
    values (p_user_id, s.terms_version, s.privacy_version, 'adult', null);
end $$;
