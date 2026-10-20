-- Run prepare before the migration, then checks after it, inside one rolled-back transaction.
-- PREPARE
create temp table username_before on commit drop as
 select h.user_id,h.username,
  ((h.username='s_'||replace(p.id::text,'-','') or h.username ~ ('^learner_'||substr(replace(p.id::text,'-',''),1,10)||'(_[0-9]+)?$'))
   and nullif(lower(btrim(u.raw_user_meta_data->>'username')),'') is distinct from h.username) generated
 from public.friend_handles h join public.profiles p on p.id=h.user_id join auth.users u on u.id=p.id;
-- CHECKS
do $$
declare actor uuid; candidate text; edit_name text:='editable_'||left(replace(gen_random_uuid()::text,'-',''),10);
begin
 if private.email_username_base('Ana.Lopez+course@example.invalid')<>'ana_lopez' then raise exception 'Email normalization failed'; end if;
 if private.email_username_base('123@example.invalid')<>'student_123' then raise exception 'Leading digit handling failed'; end if;
 if private.email_username_base('a@example.invalid')<>'student_a' then raise exception 'Short username handling failed'; end if;
 if private.email_username_base(null)<>'student' then raise exception 'Missing email fallback failed'; end if;
 if length(private.email_username_base(repeat('a',50)||'@example.invalid'))<>24 then raise exception 'Length limit failed'; end if;
 if exists(select 1 from public.friend_handles where username !~ '^[a-z][a-z0-9_]{2,23}$') then raise exception 'Invalid public handle'; end if;
 if exists(select 1 from username_before b join public.friend_handles h on h.user_id=b.user_id where not b.generated and h.username<>b.username) then raise exception 'Chosen username overwritten'; end if;
 if exists(select 1 from username_before b join public.friend_handles h on h.user_id=b.user_id where b.generated and h.username=b.username) then raise exception 'Generated username not replaced'; end if;
 select p.id into strict actor from public.profiles p join public.friend_handles h on h.user_id=p.id where p.deactivated_at is null limit 1;
 select private.available_username(h.username,gen_random_uuid()) into candidate from public.friend_handles h where h.user_id=actor;
 if exists(select 1 from public.friend_handles where username=candidate) or candidate !~ '^[a-z][a-z0-9_]{2,23}$' then raise exception 'Collision resolution failed'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.headers','{"x-client-platform":"web","x-client-build":"999999","x-api-version":"1"}',true);
 perform public.set_friend_username_v1(edit_name);
 if private.public_username(actor)<>edit_name then raise exception 'Generated handle cannot be edited'; end if;
 if has_function_privilege('anon','private.assign_username(uuid)','execute') or has_function_privilege('authenticated','private.email_username_base(text)','execute') then raise exception 'Private email helper exposed'; end if;
end $$;
