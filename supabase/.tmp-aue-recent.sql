select lv.title, l.position, lv.status, lv.published_at,
  jsonb_array_length(coalesce(lv.blocks, '[]'::jsonb)) as blocks_len
from public.lessons l
join public.courses c on c.id = l.course_id and c.code = 'AUE-GST 201'
join public.lesson_versions lv on lv.lesson_id = l.id and lv.status = 'published'
where lv.published_at > '2026-10-24'::timestamptz
order by lv.published_at desc;

select qv.status, count(*) from public.question_versions qv
join public.questions q on q.id = qv.question_id
join public.courses c on c.id = q.course_id and c.code = 'AUE-GST 201'
where qv.created_at > '2026-10-24'::timestamptz
group by qv.status;
