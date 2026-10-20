-- Manual awards use the same append-only ledger and cached totals as earned XP.
-- No earning caps apply. Bigint ledger amounts support large manual awards.
alter table public.points_ledger alter column requested_amount type bigint, alter column amount type bigint;
alter table private.point_rules drop constraint point_rules_code_check;
alter table private.point_rules add constraint point_rules_code_check check
 (code in ('lesson_complete','review_correct','practice_first','mock_first','battle_win','battle_draw','battle_loss','signup_welcome','admin_manual'));
alter table public.points_ledger drop constraint points_ledger_source_type_check;
alter table public.points_ledger add constraint points_ledger_source_type_check check
 (source_type in ('lesson','review','practice','mock','battle','correction','signup','admin'));
insert into private.point_rules(code,version,amount,daily_cap,policy,effective_from)
 values('admin_manual',1,0,null,'{"manual":true}',now());

-- Administrator-only account directory and lifecycle. No credentials are returned.
create or replace function private.admin_user_payload(p_user_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
select jsonb_build_object('id',u.id,'email',u.email,'display_name',p.display_name,
 'xp_total',coalesce((select total from public.user_points where user_id=u.id),0),
 'registered_at',u.created_at,'last_sign_in_at',u.last_sign_in_at,'email_verified',u.email_confirmed_at is not null,
 'deactivated_at',p.deactivated_at,'updated_at',p.updated_at,'has_profile',p.id is not null,
 'category',case when exists(select 1 from public.user_roles where user_id=u.id and role='lecturer') or p.registration_kind='lecturer_applicant' then 'lecturer' when exists(select 1 from public.user_roles where user_id=u.id and role='student') then 'student' else 'other' end,
 'roles',coalesce((select jsonb_agg(role order by role) from public.user_roles where user_id=u.id),'[]'::jsonb),
 'application_status',(select status from public.lecturer_applications where user_id=u.id),
 'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'code',c.code,'title',c.title,'status',o.status) order by c.code,o.id)
 from public.lecturer_course_assignments a join public.course_offerings o on o.id=a.offering_id join public.courses c on c.id=o.course_id where a.user_id=u.id),'[]'::jsonb))
from auth.users u left join public.profiles p on p.id=u.id where u.id=p_user_id;
$$;


create function public.admin_award_xp_v1(p_user_id uuid,p_amount bigint,p_reason text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=private.require_admin(); prior private.audit_log; balance bigint; rule uuid;
 note text:=coalesce(nullif(btrim(p_reason),''),'Manual XP award');
begin
 perform private.assert_client_supported(); perform private.require_request_key(p_request_key);
 if p_user_id is null or p_amount is null or p_amount<1 or p_amount>9007199254740991 or length(note)>500 then
  perform private.raise_error('VALIDATION_FAILED','Enter a positive whole number of XP.');
 end if;
 -- Serialize identical requests before examining the audit record, including requests for different users.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':admin_award_xp:'||p_request_key::text,0));
 select * into prior from private.audit_log where actor_id=actor and action='award_xp' and request_key=p_request_key;
 if found then
  if prior.entity_id is distinct from p_user_id or (prior.safe_metadata->>'amount')::bigint is distinct from p_amount or prior.reason is distinct from note then
   perform private.raise_error('VALIDATION_FAILED','This request key was already used for a different award.');
  end if;
  return private.envelope(jsonb_build_object('amount',p_amount,'xp_total',(prior.safe_metadata->>'xp_total')::bigint,'replayed',true),p_request_key);
 end if;
 -- Include administrators and frozen users. Only an existing application profile is required.
 perform 1 from public.profiles where id=p_user_id for key share;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 insert into public.user_points(user_id,total) values(p_user_id,0) on conflict do nothing;
 select total into balance from public.user_points where user_id=p_user_id for update;
 if balance>9007199254740991-p_amount then perform private.raise_error('VALIDATION_FAILED','The resulting XP balance exceeds the supported numeric range.'); end if;
 select id into rule from private.point_rules where code='admin_manual' order by version desc limit 1;
 insert into public.points_ledger(user_id,source_type,source_id,event_key,rule_id,requested_amount,amount,cap_applied,reason,actor_id,local_date)
 values(p_user_id,'admin',p_request_key,'admin:'||actor::text||':'||p_request_key::text,rule,p_amount,p_amount,false,note,actor,private.lagos_date(now()));
 update public.user_points set total=total+p_amount,updated_at=now() where user_id=p_user_id returning total into balance;
 perform private.audit(actor,'award_xp','profile',p_user_id,p_request_key,note,jsonb_build_object('amount',p_amount,'xp_total',balance));
 return private.envelope(jsonb_build_object('amount',p_amount,'xp_total',balance,'replayed',false),p_request_key);
end $$;
revoke all on function public.admin_award_xp_v1(uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_award_xp_v1(uuid,bigint,text,uuid) to authenticated;
