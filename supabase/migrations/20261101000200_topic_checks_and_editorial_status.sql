-- Practice-bank editorial marks and per-topic pre/post checks.
-- editorial_status is set while a version is still a draft. Published rows stay immutable.

alter table public.lesson_versions
  add column if not exists editorial_status text
  check (editorial_status is null or editorial_status in ('corrected', 'flagged'));

alter table public.question_versions
  add column if not exists editorial_status text
  check (editorial_status is null or editorial_status in ('corrected', 'flagged'));

comment on column public.lesson_versions.editorial_status is
  'Source-register mark: corrected or flagged. Null means no register note applied.';
comment on column public.question_versions.editorial_status is
  'Source-register mark: corrected or flagged. Null means no register note applied.';

create table public.topic_check_items (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  topic_key text not null,
  topic_title text not null,
  kind text not null check (kind in ('pre', 'post')),
  position integer not null check (position > 0),
  logical_question_key text not null,
  unique (course_code, topic_key, kind, position),
  unique (course_code, topic_key, kind, logical_question_key)
);

create table public.topic_check_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_code text not null,
  topic_key text not null,
  kind text not null check (kind in ('pre', 'post')),
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  completed_at timestamptz not null default now(),
  unique (user_id, course_code, topic_key, kind)
);

alter table public.topic_check_items enable row level security;
alter table public.topic_check_attempts enable row level security;

create index topic_check_attempts_user on public.topic_check_attempts(user_id, course_code, topic_key);

create or replace function public.submit_topic_check_v1(
  p_course_code text,
  p_topic_key text,
  p_kind text,
  p_answers jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_item record;
  v_selected text;
  v_correct text;
  v_score integer := 0;
  v_total integer := 0;
  v_stored jsonb := '[]'::jsonb;
  v_title text;
begin
  if p_kind not in ('pre', 'post') then
    perform private.raise_error('VALIDATION_FAILED', 'Check kind must be pre or post.');
  end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then
    perform private.raise_error('VALIDATION_FAILED', 'Answers must be a list.');
  end if;
  for v_item in
    select i.logical_question_key, i.topic_title, i.position
    from public.topic_check_items i
    where i.course_code = p_course_code and i.topic_key = p_topic_key and i.kind = p_kind
    order by i.position
  loop
    v_title := v_item.topic_title;
    v_total := v_total + 1;
    select upper(o.label) into v_correct
    from public.questions q
    join public.courses c on c.id = q.course_id and c.code = p_course_code
    join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
    join private.question_answer_keys k on k.question_version_id = qv.id
    join public.question_options o on o.id = k.correct_option_id
    where q.logical_key = v_item.logical_question_key
    limit 1;
    if v_correct is null then
      perform private.raise_error('CONTENT_UNAVAILABLE', 'Publish the practice questions before saving this check.');
    end if;
    select upper(btrim(a.value ->> 'selected')) into v_selected
    from jsonb_array_elements(p_answers) a(value)
    where a.value ->> 'logical_question_key' = v_item.logical_question_key
    limit 1;
    v_stored := v_stored || jsonb_build_array(jsonb_build_object(
      'logical_question_key', v_item.logical_question_key,
      'correct', v_selected is not null and v_selected = v_correct
    ));
    if v_selected is not null and v_selected = v_correct then
      v_score := v_score + 1;
    end if;
  end loop;
  if v_total = 0 then
    perform private.raise_error('NOT_FOUND', 'This topic has no saved check.');
  end if;
  insert into public.topic_check_attempts (user_id, course_code, topic_key, kind, score, total, answers)
  values (v_uid, p_course_code, p_topic_key, p_kind, v_score, v_total, v_stored)
  on conflict (user_id, course_code, topic_key, kind) do update
    set score = excluded.score, total = excluded.total, answers = excluded.answers, completed_at = now();
  return private.envelope(jsonb_build_object(
    'course_code', p_course_code, 'topic_key', p_topic_key, 'topic_title', v_title,
    'kind', p_kind, 'score', v_score, 'total', v_total
  ));
end;
$$;

create or replace function public.get_my_topic_gap_report_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  return private.envelope(jsonb_build_object('topics', coalesce((
    select jsonb_agg(jsonb_build_object(
      'course_code', keys.course_code,
      'topic_key', keys.topic_key,
      'topic_title', coalesce((select i.topic_title from public.topic_check_items i
        where i.course_code = keys.course_code and i.topic_key = keys.topic_key limit 1), keys.topic_key),
      'pre_score', pre.score,
      'pre_total', pre.total,
      'post_score', post.score,
      'post_total', post.total,
      'gain', case when pre.score is null or post.score is null then null else post.score - pre.score end
    ) order by keys.course_code, keys.topic_key)
    from (
      select distinct course_code, topic_key
      from public.topic_check_attempts
      where user_id = v_uid
    ) keys
    left join public.topic_check_attempts pre
      on pre.user_id = v_uid and pre.course_code = keys.course_code and pre.topic_key = keys.topic_key and pre.kind = 'pre'
    left join public.topic_check_attempts post
      on post.user_id = v_uid and post.course_code = keys.course_code and post.topic_key = keys.topic_key and post.kind = 'post'
  ), '[]'::jsonb)));
end;
$$;

create or replace function public.get_topic_gap_aggregate_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_rows jsonb;
  v_suppressed integer;
begin
  if not exists (
    select 1 from public.user_roles r
    where r.user_id = v_uid and r.role in ('admin', 'lecturer')
  ) then
    perform private.raise_error('FORBIDDEN');
  end if;
  with paired as (
    select pre.user_id, pre.course_code, pre.topic_key,
           pre.score::numeric / pre.total as pre_ratio,
           post.score::numeric / post.total as post_ratio,
           pr.department_id
    from public.topic_check_attempts pre
    join public.topic_check_attempts post
      on post.user_id = pre.user_id
     and post.course_code = pre.course_code
     and post.topic_key = pre.topic_key
     and post.kind = 'post'
    join public.profiles pr on pr.id = pre.user_id
    where pre.kind = 'pre'
  ), grouped as (
    select coalesce(d.name, 'Unspecified') as department,
           p.course_code,
           p.topic_key,
           count(*) as students,
           round(avg(p.pre_ratio) * 100, 1) as pre_mean_percent,
           round(avg(p.post_ratio) * 100, 1) as post_mean_percent,
           round(avg(p.post_ratio - p.pre_ratio) * 100, 1) as mean_gain_percent
    from paired p
    left join public.departments d on d.id = p.department_id
    group by d.name, p.course_code, p.topic_key
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object(
      'department', g.department,
      'course_code', g.course_code,
      'topic_key', g.topic_key,
      'topic_title', coalesce((select i.topic_title from public.topic_check_items i
        where i.course_code = g.course_code and i.topic_key = g.topic_key limit 1), g.topic_key),
      'students', g.students,
      'pre_mean_percent', g.pre_mean_percent,
      'post_mean_percent', g.post_mean_percent,
      'mean_gain_percent', g.mean_gain_percent
    ) order by g.department, g.course_code, g.topic_key)
    from grouped g where g.students >= 5), '[]'::jsonb),
    coalesce((select count(*) from grouped g where g.students < 5), 0)
  into v_rows, v_suppressed;
  return private.envelope(jsonb_build_object(
    'minimum_students', 5,
    'rows', v_rows,
    'suppressed_cells', v_suppressed
  ));
end;
$$;

revoke all on function public.submit_topic_check_v1(text, text, text, jsonb) from public, anon;
revoke all on function public.get_my_topic_gap_report_v1() from public, anon;
revoke all on function public.get_topic_gap_aggregate_v1() from public, anon;
grant execute on function public.submit_topic_check_v1(text, text, text, jsonb) to authenticated;
grant execute on function public.get_my_topic_gap_report_v1() to authenticated;
grant execute on function public.get_topic_gap_aggregate_v1() to authenticated;
