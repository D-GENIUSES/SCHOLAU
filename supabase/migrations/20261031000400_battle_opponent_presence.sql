-- Show online presence and battle-busy state when picking a direct opponent.
begin;

create or replace function public.get_friends_v1() returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user();
begin
  return private.envelope(jsonb_build_object('username',private.public_username(viewer),
    'people',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.id,'display_name',p.display_name,'username',h.username,
      'avatar_path',p.avatar_path,'state',f.state,'incoming',f.actor_id<>viewer,
      'online', private.user_is_online_v1(p.id),
      'battle_busy', private.battle_opponent_status(p.id)
    ) order by f.updated_at desc)
    from public.friendships f join public.profiles p on p.id=case when f.user_low=viewer then f.user_high else f.user_low end
    left join public.friend_handles h on h.user_id=p.id
    where viewer in(f.user_low,f.user_high) and p.deactivated_at is null
      and (f.state<>'blocked' or f.actor_id=viewer)),'[]'::jsonb)));
end $$;

create or replace function public.search_friends_v1(p_query text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=private.require_user(); query text:=lower(ltrim(btrim(p_query),'@'));
begin
  if length(coalesce(query,''))<3 or length(query)>60 then return private.envelope(jsonb_build_object('people','[]'::jsonb)); end if;
  return private.envelope(jsonb_build_object('people',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',p.id,'display_name',p.display_name,'username',h.username,'avatar_path',p.avatar_path,
      'state',f.state,'incoming',coalesce(f.actor_id<>viewer,false),
      'online', private.user_is_online_v1(p.id),
      'battle_busy', private.battle_opponent_status(p.id)
    ) order by h.username nulls last,p.id) from public.profiles p
    left join public.friend_handles h on h.user_id=p.id
    left join public.friendships f on f.user_low=least(viewer,p.id) and f.user_high=greatest(viewer,p.id)
    where p.id<>viewer and private.can_view_public_profile(viewer,p.id)
      and (strpos(lower(p.display_name),query)>0 or strpos(h.username,query)>0)
    limit 20),'[]'::jsonb)));
end $$;

notify pgrst, 'reload schema';
commit;
