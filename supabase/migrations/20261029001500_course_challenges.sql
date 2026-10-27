-- Course challenges are RPC-only; answer keys never enter a client-readable table.
create table private.course_challenges (
 id uuid primary key, offering_id uuid not null references public.course_offerings(id),
 created_by uuid not null references public.profiles(id), title text not null,
 instructions text not null default '', duration_minutes integer not null check(duration_minutes between 1 and 180),
 questions jsonb not null default '[]', status text not null default 'draft' check(status in ('draft','published','cancelled')),
 starts_at timestamptz, ends_at timestamptz, revision integer not null default 1,
 created_at timestamptz not null default now(), check(length(title) between 1 and 160),
 check(length(instructions)<=4000), check(jsonb_typeof(questions)='array' and jsonb_array_length(questions)<=100)
);
create index course_challenges_offering on private.course_challenges(offering_id,created_at desc);
create table private.course_challenge_attempts (
 challenge_id uuid not null references private.course_challenges(id), user_id uuid not null references public.profiles(id),
 answers jsonb not null default '{}', revision integer not null default 1,
 joined_at timestamptz not null default now(), submitted_at timestamptz,
 primary key(challenge_id,user_id)
);
alter table private.course_challenges enable row level security;
alter table private.course_challenge_attempts enable row level security;
revoke all on private.course_challenges,private.course_challenge_attempts from public,anon,authenticated;

create function private.challenge_teacher(p_offering uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lecturer_course_assignments a join public.user_roles r on r.user_id=a.user_id and r.role='lecturer'
 join public.profiles p on p.id=a.user_id and p.deactivated_at is null join auth.users u on u.id=p.id and u.email_confirmed_at is not null
 where a.offering_id=p_offering and a.user_id=p_user)
$$;
create function private.challenge_student(p_offering uuid,p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.enrollments e join public.user_roles r on r.user_id=e.user_id and r.role='student'
 join public.profiles p on p.id=e.user_id and p.deactivated_at is null
 where e.offering_id=p_offering and e.user_id=p_user and e.ended_at is null)
$$;
create function private.challenge_state(c private.course_challenges) returns text language sql volatile set search_path='' as $$
 select case when c.status<>'published' then c.status when clock_timestamp()<c.starts_at then 'upcoming' when clock_timestamp()<c.ends_at then 'active' else 'finished' end
$$;
create function private.challenge_summary(c private.course_challenges) returns jsonb language sql volatile set search_path='' as $$
 select jsonb_build_object('id',c.id,'offering_id',c.offering_id,'title',c.title,'instructions',c.instructions,
 'duration_minutes',c.duration_minutes,'state',private.challenge_state(c),'starts_at',c.starts_at,'ends_at',c.ends_at,
 'revision',c.revision,'question_count',jsonb_array_length(c.questions))
$$;
create function private.challenge_score(p_questions jsonb,p_answers jsonb) returns integer language sql immutable set search_path='' as $$
 select count(*)::integer from jsonb_array_elements(p_questions) with ordinality q(v,n) where p_answers->>((n-1)::text)=q.v->>'correct'
$$;

create function public.list_course_challenges_v1(p_offering_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); teacher boolean:=private.challenge_teacher(p_offering_id,u); allowed boolean; items jsonb;
begin
 allowed:=teacher or private.challenge_student(p_offering_id,u);
 if not allowed and not exists(select 1 from private.course_challenge_attempts a join private.course_challenges c on c.id=a.challenge_id where c.offering_id=p_offering_id and a.user_id=u) then perform private.raise_error('FORBIDDEN'); end if;
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.id),'[]') into items from (
 select private.challenge_summary(c) item,c.created_at,c.id from private.course_challenges c where c.offering_id=p_offering_id
 and (teacher or (c.status<>'draft' and (allowed or exists(select 1 from private.course_challenge_attempts a where a.challenge_id=c.id and a.user_id=u))))
 order by c.created_at desc,c.id limit 20 offset greatest(0,coalesce(p_offset,0))) x;
 return private.envelope(jsonb_build_object('items',items,'teacher',teacher,'course',(
 select jsonb_build_object('code',co.code,'title',co.title,'semester',s.label,'period',ap.label) from public.course_offerings o join public.courses co on co.id=o.course_id join public.semesters s on s.id=o.semester_id join public.academic_periods ap on ap.id=s.academic_period_id where o.id=p_offering_id)));
end $$;

create function public.challenge_question_bank_v1(p_offering_id uuid,p_search text default '',p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); items jsonb;
begin
 if not private.challenge_teacher(p_offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 select coalesce(jsonb_agg(x.item order by x.id),'[]') into items from (
 select v.id,jsonb_build_object('source_version_id',v.id,'prompt',v.prompt,'options',(select jsonb_agg(o.body order by o.position,o.id) from public.question_options o where o.question_version_id=v.id),
 'correct',(select count(*)::int from public.question_options o join public.question_options correct on correct.id=k.correct_option_id where o.question_version_id=v.id and (o.position,o.id)<(correct.position,correct.id)), 'explanation',k.explanation) item
 from public.question_versions v join public.questions q on q.id=v.question_id join public.course_offerings co on co.course_id=q.course_id
 join private.question_answer_keys k on k.question_version_id=v.id where co.id=p_offering_id and v.status='published' and v.answer_format='standard'
 and (select count(*) from public.question_options o where o.question_version_id=v.id)=4
 and v.prompt ilike '%'||left(coalesce(p_search,''),100)||'%' order by v.id limit 20 offset greatest(0,coalesce(p_offset,0))) x;
 return private.envelope(jsonb_build_object('items',items));
end $$;

create function public.save_course_challenge_v1(p_id uuid,p_offering_id uuid,p_revision integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; questions jsonb:='[]'; q jsonb; v jsonb; source uuid;
begin
 if not private.challenge_teacher(p_offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if not exists(select 1 from public.course_offerings where id=p_offering_id and status='published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 if p_id is null or coalesce(length(btrim(p_data->>'title')),0) not between 1 and 160 or coalesce(length(p_data->>'instructions'),0)>4000
 or coalesce(p_data->>'duration_minutes','')!~ '^\d{1,3}$' or (p_data->>'duration_minutes')::int not between 1 and 180
 or jsonb_typeof(p_data->'questions') is distinct from 'array' then perform private.raise_error('VALIDATION_FAILED'); end if;
 if jsonb_array_length(p_data->'questions')>100 then perform private.raise_error('VALIDATION_FAILED'); end if;
 -- Lock a stable client-generated UUID so retries cannot create duplicate drafts.
 perform pg_advisory_xact_lock(hashtextextended('course-challenge:'||p_id::text,0));
 select * into c from private.course_challenges where id=p_id for update;
 if found then
  if c.offering_id<>p_offering_id then perform private.raise_error('FORBIDDEN'); end if;
  if c.status<>'draft' then perform private.raise_error('INVALID_STATE'); end if;
  if c.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
 elsif p_revision is distinct from 0 then perform private.raise_error('STALE_REVISION'); end if;
 for q in select value from jsonb_array_elements(p_data->'questions') loop
  source:=nullif(q->>'source_version_id','')::uuid;
  if source is not null then
   select jsonb_build_object('source_version_id',v.id,'prompt',v.prompt,'options',(select jsonb_agg(o.body order by o.position,o.id) from public.question_options o where o.question_version_id=v.id),
    'correct',(select count(*)::int from public.question_options o join public.question_options correct on correct.id=k.correct_option_id where o.question_version_id=v.id and (o.position,o.id)<(correct.position,correct.id)),'explanation',k.explanation) into v
   from public.question_versions v join public.questions x on x.id=v.question_id join private.question_answer_keys k on k.question_version_id=v.id
   join public.course_offerings co on co.course_id=x.course_id where co.id=p_offering_id and v.id=source and v.status='published' and v.answer_format='standard';
   if v is null or exists(select 1 from jsonb_array_elements(questions) x where x->>'source_version_id'=source::text) then perform private.raise_error('VALIDATION_FAILED','Select distinct published questions from this course.'); end if;
   q:=v;
  end if;
  if coalesce(length(btrim(q->>'prompt')),0) not between 1 and 2000 or jsonb_typeof(q->'options') is distinct from 'array'
   or coalesce(q->>'correct','')!~ '^[0-3]$' or coalesce(length(q->>'explanation'),0)>4000 then perform private.raise_error('VALIDATION_FAILED','Complete the question and its answer key.'); end if;
  if jsonb_array_length(q->'options')<>4 or exists(select 1 from jsonb_array_elements(q->'options') x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 1 and 1000)
   or (select count(distinct lower(btrim(x))) from jsonb_array_elements_text(q->'options') x)<>4 then perform private.raise_error('VALIDATION_FAILED','Provide four different options.'); end if;
  questions:=questions||jsonb_build_array(jsonb_build_object('source_version_id',source,'prompt',btrim(q->>'prompt'),'options',q->'options','correct',(q->>'correct')::int,'explanation',coalesce(q->>'explanation','')));
 end loop;
 insert into private.course_challenges(id,offering_id,created_by,title,instructions,duration_minutes,questions,starts_at)
 values(p_id,p_offering_id,u,btrim(p_data->>'title'),coalesce(p_data->>'instructions',''),(p_data->>'duration_minutes')::int,questions,nullif(p_data->>'starts_at','')::timestamptz)
 on conflict(id) do update set title=excluded.title,instructions=excluded.instructions,duration_minutes=excluded.duration_minutes,questions=excluded.questions,starts_at=excluded.starts_at,revision=private.course_challenges.revision+1 returning * into c;
 return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c),'questions',c.questions));
end $$;

create function public.publish_course_challenge_v1(p_id uuid,p_revision integer,p_starts_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; start_time timestamptz;
begin
 select * into c from private.course_challenges where id=p_id for update;
 if not found or not private.challenge_teacher(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if c.status='published' then return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c))); end if;
 if c.status<>'draft' then perform private.raise_error('INVALID_STATE'); end if;
 if c.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
 if jsonb_array_length(c.questions) not between 1 and 100 then perform private.raise_error('VALIDATION_FAILED','Add at least one question.'); end if;
 if not exists(select 1 from public.course_offerings where id=c.offering_id and status='published') then perform private.raise_error('CONTENT_UNAVAILABLE'); end if;
 start_time:=coalesce(p_starts_at,clock_timestamp());
 if p_starts_at is not null and p_starts_at<clock_timestamp() then perform private.raise_error('VALIDATION_FAILED','Choose a future start time.'); end if;
 update private.course_challenges set status='published',starts_at=start_time,ends_at=start_time+make_interval(mins=>duration_minutes),revision=revision+1 where id=p_id returning * into c;
 insert into public.notifications(user_id,kind,body,safe_target,event_key)
 select e.user_id,'course_challenge','New course challenge: '||c.title,'/challenges/'||c.id::text,'course-challenge:'||c.id::text||':'||e.user_id::text
 from public.enrollments e where e.offering_id=c.offering_id and e.ended_at is null and private.challenge_student(c.offering_id,e.user_id) on conflict(event_key) do nothing;
 perform private.audit(u,'publish_course_challenge','course_challenge',c.id,null);
 return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c)));
end $$;
create function public.cancel_course_challenge_v1(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges;
begin
 select * into c from private.course_challenges where id=p_id for update;
 if not found or not private.challenge_teacher(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if private.challenge_state(c)='finished' then perform private.raise_error('INVALID_STATE','A finished challenge cannot be cancelled.'); end if;
 update private.course_challenges set status='cancelled',revision=revision+1 where id=p_id and status<>'cancelled' returning * into c;
 return private.envelope(jsonb_build_object('cancelled',true));
end $$;

create function public.get_course_challenge_v1(p_id uuid,p_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; a private.course_challenge_attempts; teacher boolean; questions jsonb:='[]'; target uuid:=coalesce(p_user_id,u); finished boolean;
begin
 select * into c from private.course_challenges where id=p_id for share;
 if not found then perform private.raise_error('NOT_FOUND'); end if;
 teacher:=private.challenge_teacher(c.offering_id,u);
 if not teacher and (target<>u or c.status='draft' or not (private.challenge_student(c.offering_id,u) or exists(select 1 from private.course_challenge_attempts where challenge_id=p_id and user_id=u))) then perform private.raise_error('FORBIDDEN'); end if;
 finished:=private.challenge_state(c)='finished';
 -- Finalize only the selected attempt here; avoid acquiring other attempt locks after submit locks its own row.
 if finished then update private.course_challenge_attempts set submitted_at=c.ends_at,revision=revision+1 where challenge_id=p_id and user_id=target and submitted_at is null; end if;
 select * into a from private.course_challenge_attempts where challenge_id=p_id and user_id=target;
 if (teacher and c.status='draft') or finished then questions:=c.questions;
 elsif c.status='published' and clock_timestamp()>=c.starts_at and (teacher or a.user_id is not null) then
 select coalesce(jsonb_agg(q-'correct'-'explanation'-'source_version_id'),'[]') into questions from jsonb_array_elements(c.questions) q;
 end if;
 return private.envelope(jsonb_build_object('challenge',private.challenge_summary(c),'teacher',teacher,'questions',questions,
 'attempt',case when a.user_id is null then null else jsonb_build_object('answers',a.answers,'revision',a.revision,'submitted_at',a.submitted_at,
 'score',case when finished then private.challenge_score(c.questions,a.answers) else null end) end));
end $$;

create function public.join_course_challenge_v1(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges;
begin
 select * into c from private.course_challenges where id=p_id for share;
 if not found or not private.challenge_student(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 if private.challenge_state(c)<>'active' or clock_timestamp()>=c.ends_at then perform private.raise_error('INVALID_STATE','This challenge is not open.'); end if;
 insert into private.course_challenge_attempts(challenge_id,user_id) values(p_id,u) on conflict do nothing;
 return public.get_course_challenge_v1(p_id);
end $$;
create function public.answer_course_challenge_v1(p_id uuid,p_question integer,p_option integer,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; a private.course_challenge_attempts;
begin
 select * into c from private.course_challenges where id=p_id for share;
 if not found or not private.challenge_student(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 select * into a from private.course_challenge_attempts where challenge_id=p_id and user_id=u for update;
 if not found or a.submitted_at is not null or private.challenge_state(c)<>'active' or clock_timestamp()>=c.ends_at then perform private.raise_error('DEADLINE_PASSED'); end if;
 if p_question is null or p_question<0 or p_question>=jsonb_array_length(c.questions) or p_option is null or p_option not between 0 and 3 then perform private.raise_error('VALIDATION_FAILED'); end if;
 if a.answers->>p_question::text=p_option::text then return public.get_course_challenge_v1(p_id); end if;
 if a.revision is distinct from p_revision then perform private.raise_error('STALE_REVISION'); end if;
 update private.course_challenge_attempts set answers=jsonb_set(answers,array[p_question::text],to_jsonb(p_option)),revision=revision+1 where challenge_id=p_id and user_id=u;
 return public.get_course_challenge_v1(p_id);
end $$;
create function public.submit_course_challenge_v1(p_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; a private.course_challenge_attempts;
begin
 select * into c from private.course_challenges where id=p_id for share;
 if not found or not private.challenge_student(c.offering_id,u) then perform private.raise_error('FORBIDDEN'); end if;
 select * into a from private.course_challenge_attempts where challenge_id=p_id and user_id=u for update;
 if not found or c.status<>'published' or clock_timestamp()<c.starts_at then perform private.raise_error('INVALID_STATE'); end if;
 if a.submitted_at is null then
  if a.revision is distinct from p_revision and clock_timestamp()<c.ends_at then perform private.raise_error('STALE_REVISION'); end if;
  update private.course_challenge_attempts set submitted_at=least(clock_timestamp(),c.ends_at),revision=revision+1 where challenge_id=p_id and user_id=u;
 end if;
 return public.get_course_challenge_v1(p_id);
end $$;

create function public.course_challenge_roster_v1(p_offering_id uuid,p_challenge_id uuid default null,p_search text default '',p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); c private.course_challenges; teacher boolean:=private.challenge_teacher(p_offering_id,u); items jsonb; finished boolean:=false; total integer;
begin
 if p_challenge_id is not null then
  select * into c from private.course_challenges where id=p_challenge_id and offering_id=p_offering_id for share;
  if not found then perform private.raise_error('NOT_FOUND'); end if;
  finished:=private.challenge_state(c)='finished';
 end if;
 if not teacher and (p_challenge_id is null or not finished or not(private.challenge_student(p_offering_id,u) or exists(select 1 from private.course_challenge_attempts where challenge_id=p_challenge_id and user_id=u))) then perform private.raise_error('FORBIDDEN'); end if;
 if finished then update private.course_challenge_attempts set submitted_at=c.ends_at,revision=revision+1 where challenge_id=p_challenge_id and submitted_at is null; end if;
 -- Rank before pagination/search. Anonymous labels never expose another student's UUID.
 with participants as (
 select a.user_id,a.submitted_at,private.challenge_score(c.questions,a.answers) score,
 extract(epoch from (a.submitted_at-c.starts_at)) elapsed_seconds,
 row_number() over(order by a.joined_at,a.user_id) alias_number from private.course_challenge_attempts a where a.challenge_id=p_challenge_id
 ), ranked as (select *,rank() over(order by score desc,elapsed_seconds) place from participants), people as (
 select p.id,p.display_name,p.leaderboard_visible,r.* from public.profiles p left join ranked r on r.user_id=p.id
 where (teacher and exists(select 1 from public.enrollments e where e.user_id=p.id and e.offering_id=p_offering_id and e.ended_at is null)) or r.user_id is not null
 ), visible as (
 select id,case when teacher or id=u or leaderboard_visible then display_name else 'Participant '||alias_number::text end name,
 user_id,submitted_at,score,elapsed_seconds,place from people
 ), filtered as (select * from visible where name ilike '%'||left(coalesce(p_search,''),100)||'%'), page as (
 select * from filtered order by case when finished then place end nulls last,name,id limit 20 offset greatest(0,coalesce(p_offset,0)))
 select (select count(*)::int from filtered),coalesce(jsonb_agg(jsonb_build_object('user_id',case when teacher or id=u then id else null end,'name',name,'is_me',id=u,
 'status',case when user_id is null then 'not_participated' when submitted_at is null then 'participating' else 'submitted' end,
 'score',case when finished then score end,'elapsed_seconds',case when finished then elapsed_seconds end,'rank',case when finished then place end)
 order by case when finished then place end nulls last,name,id),'[]') into total,items from page;
 return private.envelope(jsonb_build_object('items',items,'total',total,'finished',finished));
end $$;

-- Explicit grants: no internal helper/table is exposed to browser roles.
revoke all on function private.challenge_teacher(uuid,uuid),private.challenge_student(uuid,uuid),private.challenge_state(private.course_challenges),private.challenge_summary(private.course_challenges),private.challenge_score(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.list_course_challenges_v1(uuid,integer),public.challenge_question_bank_v1(uuid,text,integer),public.save_course_challenge_v1(uuid,uuid,integer,jsonb),public.publish_course_challenge_v1(uuid,integer,timestamptz),public.cancel_course_challenge_v1(uuid),public.get_course_challenge_v1(uuid,uuid),public.join_course_challenge_v1(uuid),public.answer_course_challenge_v1(uuid,integer,integer,integer),public.submit_course_challenge_v1(uuid,integer),public.course_challenge_roster_v1(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.list_course_challenges_v1(uuid,integer),public.challenge_question_bank_v1(uuid,text,integer),public.save_course_challenge_v1(uuid,uuid,integer,jsonb),public.publish_course_challenge_v1(uuid,integer,timestamptz),public.cancel_course_challenge_v1(uuid),public.get_course_challenge_v1(uuid,uuid),public.join_course_challenge_v1(uuid),public.answer_course_challenge_v1(uuid,integer,integer,integer),public.submit_course_challenge_v1(uuid,integer),public.course_challenge_roster_v1(uuid,uuid,text,integer) to authenticated;
