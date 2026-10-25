-- Run after the avatar welcome migration; fixture signup rolls back.
begin;
do $$
declare account uuid:=gen_random_uuid(); assigned text; result jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at)
 values(account,'welcome-avatar-fixture-'||account||'@example.invalid',(select jsonb_build_object('display_name','Welcome fixture','terms_accepted',true,'terms_version',terms_version,'privacy_version',privacy_version) from private.legal_settings where singleton),'{}','authenticated','authenticated',now(),now());
 if (select avatar_setup_completed from public.profiles where id=account) then raise exception 'New signup is incorrectly completed'; end if;
 select avatar_path into assigned from public.profiles where id=account;
 perform set_config('request.jwt.claim.sub',account::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated')::text,true);
 result:=public.get_avatar_setup_v1();
 if result->>'completed'<>'false' then raise exception 'New signup state incorrect'; end if;
 perform public.complete_avatar_setup_v1();
 result:=public.get_avatar_setup_v1();
 if result->>'completed'<>'true' then raise exception 'Completion was not persisted'; end if;
 if (select avatar_path from public.profiles where id=account) is distinct from assigned then raise exception 'Continue changed the selected avatar'; end if;
 perform public.complete_avatar_setup_v1();
 if has_function_privilege('anon','public.complete_avatar_setup_v1()','execute') then raise exception 'Anonymous completion allowed'; end if;
end $$;

rollback;