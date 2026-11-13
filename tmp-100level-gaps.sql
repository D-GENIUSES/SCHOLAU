with lvl as (
  select distinct c.id as course_id, c.code
  from public.courses c
  join public.course_offerings o on o.course_id=c.id and o.status='published'
  join public.levels lv on lv.id=o.level_id and lv.label='100 Level'
  where c.active
),
lessons as (
  select c.code, l.id as lesson_id, v.title,
         length(coalesce(private.lesson_blocks_teaching_text(v.blocks),'')) as text_len
  from lvl c
  join public.lessons l on l.course_id=c.course_id
  join public.lesson_versions v on v.lesson_id=l.id and v.status='published'
),
counts as (
  select q.lesson_id, count(*) as practice_n
  from public.questions q
  join public.question_versions qv on qv.question_id=q.id and qv.status='published'
  where q.pool='learning' and q.lesson_id is not null
    and ('practice'=any(qv.usage) or 'review'=any(qv.usage))
  group by q.lesson_id
)
select l.code,
       count(*) as lessons,
       count(*) filter (where l.text_len >= 200) as with_content,
       count(*) filter (where coalesce(c.practice_n,0) < 20 and l.text_len >= 200) as need_topup,
       sum(coalesce(c.practice_n,0)) as practice_total
from lessons l
left join counts c on c.lesson_id=l.lesson_id
group by l.code
order by l.code;
