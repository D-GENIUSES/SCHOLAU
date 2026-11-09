begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
\ir ../helpers/legal-fixtures.inc

do $$ begin
  if exists(select 1 from pg_trigger where tgrelid='private.welcome_email_events'::regclass
    and tgname='welcome_email_send_on_insert') then
    alter table private.welcome_email_events disable trigger welcome_email_send_on_insert;
  end if;
end $$;

create function pg_temp.signup_person(p_lecturer boolean) returns uuid language plpgsql as $$
declare v uuid:=gen_random_uuid(); begin
  insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_user_meta_data,created_at,updated_at)
  values('00000000-0000-0000-0000-000000000000',v,'authenticated','authenticated',
    v::text||'@welcome-mail.test',now(),
    jsonb_build_object('display_name',case when p_lecturer then 'Lecturer fixture' else 'Student fixture' end,
      'signup_kind',case when p_lecturer then 'lecturer' else 'student' end,
      'lecturer_application',case when p_lecturer then jsonb_build_object(
        'full_name','Dr Welcome Test','university','Adeleke University','faculty','Science',
        'department','Computer Science','position','Lecturer','requested_courses','CSC 201',
        'institutional_profile_url','https://example.edu/staff/welcome','verification_note','Fixture'
      ) else null end),
    now(),now());
  return v;
end $$;

create function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_user::text,true);
end $$;

select set_config('t.admin',pg_temp.signup_person(false)::text,true);
select set_config('t.student',pg_temp.signup_person(false)::text,true);
select set_config('t.lecturer',pg_temp.signup_person(true)::text,true);
insert into public.user_roles(user_id,role) values(current_setting('t.admin')::uuid,'admin') on conflict do nothing;

insert into private.legal_acceptances(user_id,terms_version,privacy_version,age_declaration)
  select current_setting('t.student')::uuid,terms_version,privacy_version,'adult' from private.legal_settings where singleton;
insert into private.legal_acceptances(user_id,terms_version,privacy_version,age_declaration)
  select current_setting('t.lecturer')::uuid,terms_version,privacy_version,'adult' from private.legal_settings where singleton;

select pg_temp.login(current_setting('t.admin')::uuid);
set local role authenticated;
select lives_ok(format(
  $$select public.admin_review_lecturer_application_v1(%L,'approved','','','{}',1,gen_random_uuid())$$,
  (select id from public.lecturer_applications where user_id=current_setting('t.lecturer')::uuid)
),'approve lecturer for welcome audience');
reset role;

select ok(exists(select 1 from private.welcome_email_events where user_id=current_setting('t.student')::uuid),'student welcome queued');
select ok(exists(select 1 from private.welcome_email_events where user_id=current_setting('t.lecturer')::uuid),'lecturer welcome queued');

update private.welcome_email_events set state='pending',attempts=0,next_attempt_at=now()
where user_id in (current_setting('t.student')::uuid,current_setting('t.lecturer')::uuid);

set local role service_role;
create temp table welcome_claim on commit drop as select * from public.claim_registration_welcome_emails_v1();
select is((select audience from welcome_claim where id=current_setting('t.student')::uuid),'student','claim returns student audience');
select is((select audience from welcome_claim where id=current_setting('t.lecturer')::uuid),'lecturer','claim returns lecturer audience');
select is((select email from welcome_claim where id=current_setting('t.student')::uuid),
  current_setting('t.student')||'@welcome-mail.test','claim returns student email');
select is((select display_name from welcome_claim where id=current_setting('t.lecturer')::uuid),'Lecturer fixture','claim returns profile display name');
select is((select attempt from welcome_claim where id=current_setting('t.student')::uuid),1,'claim increments attempt');

select lives_ok(format($$select public.finish_registration_welcome_email_v1(%L,1,'sent')$$,current_setting('t.student')),'finish marks student welcome sent');
select is((select state from private.welcome_email_events where user_id=current_setting('t.student')::uuid),'sent','student welcome state is sent');
select lives_ok(format($$select public.finish_registration_welcome_email_v1(%L,1,'retry')$$,current_setting('t.lecturer')),'finish retry keeps lecturer welcome pending');
select is((select state from private.welcome_email_events where user_id=current_setting('t.lecturer')::uuid),'pending','lecturer welcome remains pending after retry');

reset role;
set local role authenticated;
select throws_ok($$select public.claim_registration_welcome_emails_v1()$$,'42501',null,'clients cannot claim registration welcomes');

select * from finish();
rollback;
