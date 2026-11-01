-- Move each multiple-choice option to a new letter so a stored answer key
-- is not stuck on one repeating position. Option ids and answer keys stay
-- attached to the same choice text. Saved attempts store option ids.
-- Published course challenges keep the order copied into their snapshot.

alter table public.question_options disable trigger question_options_immutable;

create temp table mcq_shuffle on commit drop as
select o.id,
       row_number() over (partition by o.question_version_id order by md5(o.id::text))::integer as new_pos
from public.question_options o
join public.question_versions v on v.id = o.question_version_id
where coalesce(v.answer_format, 'standard') in ('standard', 'worked_solution')
  and o.label ~ '^[A-F]$'
  and (
    select count(*) from public.question_options x
    where x.question_version_id = o.question_version_id and x.label ~ '^[A-F]$'
  ) between 2 and 6;

update public.question_options o
set label = 't' || m.new_pos::text,
    position = 100 + m.new_pos
from mcq_shuffle m
where o.id = m.id;

update public.question_options o
set position = m.new_pos,
    label = substr('ABCDEF', m.new_pos, 1)
from mcq_shuffle m
where o.id = m.id;

alter table public.question_options enable trigger question_options_immutable;
