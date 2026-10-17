create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text; v_kind text; a jsonb;
begin
  if new.raw_user_meta_data->>'signup_kind'='admin_managed' then
    v_kind:=case when new.raw_user_meta_data->>'managed_role'='lecturer' then 'lecturer_applicant' else 'student' end;
    v_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
    if strpos(v_name,'@')>0 then perform private.raise_error('VALIDATION_FAILED','Use your name or a nickname, not your email address.'); end if;
    if length(v_name) not between 2 and 60 then perform private.raise_error('VALIDATION_FAILED','Enter a valid name.'); end if;
    insert into public.profiles(id,display_name,registration_kind,leaderboard_visible) values(new.id,v_name,v_kind,v_kind='student');
    insert into private.admin_created_accounts(user_id,role,request_key,finalized,creation_transaction)
      values(new.id,case when v_kind='student' then 'student' else 'lecturer' end,gen_random_uuid(),false,txid_current());
    return new;
  end if;
  v_kind:=case when new.raw_user_meta_data->>'signup_kind'='lecturer' then 'lecturer_applicant' else 'student' end;
  a:=new.raw_user_meta_data->'lecturer_application';
  if v_kind='lecturer_applicant' then perform private.validate_lecturer_application(a); end if;
  v_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
  if strpos(v_name,'@')>0 then perform private.raise_error('VALIDATION_FAILED','Use your name or a nickname, not your email address.'); end if;
  if length(v_name)<2 then v_name:=case when v_kind='student' then 'Student' else 'User' end; end if;
  if length(v_name)<2 then v_name:='User'; end if;
  insert into public.profiles(id,display_name,registration_kind,leaderboard_visible) values(new.id,left(v_name,60),v_kind,v_kind='student') on conflict(id) do nothing;
  if v_kind='student' then
    insert into public.user_roles(user_id,role) values(new.id,'student') on conflict do nothing;
  else
    insert into public.lecturer_applications(user_id,full_name,university,faculty,department,position,requested_courses,institutional_profile_url,verification_note)
    values(new.id,btrim(a->>'full_name'),btrim(a->>'university'),btrim(a->>'faculty'),btrim(a->>'department'),btrim(a->>'position'),btrim(a->>'requested_courses'),nullif(btrim(a->>'institutional_profile_url'),''),btrim(coalesce(a->>'verification_note','')));
  end if;
  return new;
end $$;


-- Recover a supplied name where possible; never invent a real name from an email.
update public.profiles p
set display_name = case
  when length(btrim(coalesce(u.raw_user_meta_data->>'full_name',''))) between 2 and 60
    and strpos(u.raw_user_meta_data->>'full_name','@')=0
    and u.raw_user_meta_data->>'full_name' !~ '[<>]'
  then btrim(u.raw_user_meta_data->>'full_name')
  else case when p.registration_kind='student' then 'Student' else 'User' end
end
from auth.users u
where u.id=p.id and (strpos(p.display_name,'@')>0
  or lower(p.display_name)=lower(split_part(u.email,'@',1)));

alter table public.profiles add constraint profiles_display_name_not_email
  check (strpos(display_name,'@')=0);
