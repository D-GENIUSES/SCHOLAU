-- Run after the avatar migration; all fixture accounts roll back.
begin;
create temp table photo_preservation on commit drop as select * from private.profile_photos;
create temp table uploaded_path_preservation on commit drop as select id,avatar_path from public.profiles where avatar_path like 'avatars/%';
create temp table avatar_backfill_expected on commit drop as select id,((row_number() over(order by created_at,id)-1)%6)::text preset from public.profiles where avatar_path is null;

do $$
declare ids uuid[]:='{}'; paths text[]:='{}'; account uuid; current_path text; result jsonb; i integer;
begin
 if exists(select * from photo_preservation except select * from private.profile_photos) or exists(select * from private.profile_photos except select * from photo_preservation) then raise exception 'Existing photo bytes changed'; end if;
 if exists(select * from uploaded_path_preservation except select id,avatar_path from public.profiles) then raise exception 'Existing upload paths changed'; end if;

 for i in 1..7 loop
  account:=gen_random_uuid();ids:=array_append(ids,account);
  insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
  values(account,'avatar-fixture-'||account||'@example.invalid',(select jsonb_build_object('display_name','Avatar fixture','terms_accepted',true,'age_declaration','adult','terms_version',terms_version,'privacy_version',privacy_version) from private.legal_settings where singleton),'{}','authenticated','authenticated',now(),now());
  select avatar_path into current_path from public.profiles where id=account;
  if current_path !~ '^presets/person-[0-5]$' then raise exception 'Signup did not get a preset'; end if;
  paths:=array_append(paths,current_path);
 end loop;
 if (select count(distinct x) from unnest(paths[1:6]) x)<>6 or paths[1]<>paths[7] then raise exception 'Signup round-robin failed'; end if;
 account:=ids[1];current_path:=paths[1];
 result:=public.service_set_profile_photo_v1(account,'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=',current_path);
 if result->>'avatar_path' not like 'avatars/%' then raise exception 'Photo upload failed'; end if;
 result:=public.service_set_profile_photo_v1(account,null,result->>'avatar_path');
 if result->>'avatar_path'<>current_path then raise exception 'Removing upload failed to restore preset'; end if;
 perform set_config('request.jwt.claim.sub',account::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated')::text,true);
 result:=public.set_profile_avatar_v1(5,current_path);
 if result->>'avatar_path'<>'presets/person-5' then raise exception 'Preset selection failed'; end if;
 begin
  perform public.set_profile_avatar_v1(6,'presets/person-5');
  raise exception 'Invalid avatar was accepted';
 exception when others then if sqlerrm='Invalid avatar was accepted' then raise; end if; end;
 begin
  perform public.set_profile_avatar_v1(0,'wrong-path');
  raise exception 'Stale change accepted';
 exception when others then if sqlerrm='Stale change accepted' then raise; end if; end;
 if has_function_privilege('anon','public.set_profile_avatar_v1(integer,text)','execute') then raise exception 'Anonymous access granted'; end if;
end $$;

rollback;