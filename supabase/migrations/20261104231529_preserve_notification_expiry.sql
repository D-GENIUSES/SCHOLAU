begin;
-- A caller's shorter expiry must survive notification normalization.
do $migration$
declare definition text; marker text:='new.expires_at := coalesce(new.created_at, now()) + interval ''24 hours'';';
begin
  definition:=pg_get_functiondef('private.prepare_notification()'::regprocedure);
  if position(marker in definition)=0 then raise exception 'Notification expiry anchor missing'; end if;
  definition:=replace(definition,marker,'new.expires_at := least(coalesce(new.expires_at,coalesce(new.created_at,now())+interval ''24 hours''),coalesce(new.created_at,now())+interval ''24 hours'');');
  execute definition;
end $migration$;
commit;
