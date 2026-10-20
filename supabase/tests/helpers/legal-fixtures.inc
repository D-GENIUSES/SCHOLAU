-- Synthetic adult consent for existing, non-legal regression fixtures only.
-- Included inside each test transaction and rolled back with it. Never a migration.
create function pg_temp.add_legal_fixture_metadata() returns trigger language plpgsql as $$
begin
  new.raw_user_meta_data := jsonb_build_object('terms_accepted',true,
    'terms_version','2026-10-19-draft-1','privacy_version','2026-10-19-draft-1',
    'age_declaration','adult') || coalesce(new.raw_user_meta_data,'{}'::jsonb);
  return new;
end $$;
create trigger aa_test_legal_metadata before insert on auth.users
for each row execute function pg_temp.add_legal_fixture_metadata();
