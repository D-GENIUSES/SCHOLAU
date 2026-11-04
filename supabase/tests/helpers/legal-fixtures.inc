-- Verified email and synthetic adult consent for existing, non-legal regression fixtures only.
-- Included inside each test transaction and rolled back with it. Never a migration.
create function pg_temp.add_legal_fixture_metadata() returns trigger language plpgsql as $$
begin
  -- These older tests exercise application behavior after email verification.
  -- Managed provisioning must retain its separate confirmation transaction.
  if coalesce(new.raw_user_meta_data->>'signup_kind','') <> 'admin_managed'
     and coalesce(new.raw_app_meta_data->>'provider','email') = 'email' then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  new.raw_user_meta_data := jsonb_build_object('terms_accepted',true,
    'terms_version','2026-10-19-draft-1','privacy_version','2026-10-19-draft-1',
    'age_declaration','adult') || coalesce(new.raw_user_meta_data,'{}'::jsonb);
  return new;
end $$;
create trigger aa_test_legal_metadata before insert on auth.users
for each row execute function pg_temp.add_legal_fixture_metadata();
