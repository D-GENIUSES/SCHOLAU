-- One device permission enables the complete notification bundle. No category
-- or schedule choices are required in the registration or settings interface.
create function public.enable_all_notifications_v1(
 p_owner_id uuid,p_device_key text,p_delivery_config jsonb,p_timezone text default 'Africa/Lagos'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); result jsonb; zone text;
begin
 if p_owner_id is distinct from u then perform private.raise_error('FORBIDDEN'); end if;
 select name into zone from pg_timezone_names where name=p_timezone limit 1;
 zone:=coalesce(zone,'Africa/Lagos');
 result:=public.register_push_token_v1('web',p_device_key,p_delivery_config);
 update private.notification_preferences
 set activity=true,academic=true,announcement=true,account=true,reminder=true,
     timezone=zone,configured=true,updated_at=now()
 where user_id=u;
 return result;
end $$;
revoke all on function public.enable_all_notifications_v1(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.enable_all_notifications_v1(uuid,text,jsonb,text) to authenticated;
