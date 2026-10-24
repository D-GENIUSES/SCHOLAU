begin;

create function private.registration_display_name(metadata jsonb) returns text
language sql immutable set search_path='' as $$
  select left(btrim(value),60)
  from (values (1,metadata->>'display_name'),(2,metadata->>'full_name'),
    (3,metadata->>'name'),(4,metadata->>'username')) names(priority,value)
  where length(btrim(value))>=2 and value !~ '[@<>]'
  order by priority limit 1
$$;
revoke all on function private.registration_display_name(jsonb) from public,anon,authenticated;

-- Retain the existing registration, role and consent logic.
do $$ declare definition text; needle text := 'v_name:=btrim(coalesce(new.raw_user_meta_data->>''display_name'',''''));';
begin
  select pg_get_functiondef('private.handle_new_user()'::regprocedure) into definition;
  if strpos(definition,needle)=0 then raise exception 'Unexpected registration name resolver'; end if;
  execute replace(definition,needle,
    'v_name:=coalesce(private.registration_display_name(new.raw_user_meta_data),'''');');
end $$;

-- Repair placeholders while retaining explicitly supplied names and handles.
update public.profiles p
set display_name=private.registration_display_name(u.raw_user_meta_data)
from auth.users u
where u.id=p.id and lower(btrim(p.display_name)) in ('student','students','user')
  and private.registration_display_name(u.raw_user_meta_data) is not null
  and lower(btrim(coalesce(u.raw_user_meta_data->>'display_name',''))) not in ('student','students','user');

commit;
