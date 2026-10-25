select lv.title, l.position, lv.status, lv.published_at,
  jsonb_array_length(coalesce(lv.blocks, '[]'::jsonb)) as blocks_len
from public.lessons l
join public.courses c on c.id = l.course_id and c.code = 'AUE-GST 201'
join public.lesson_versions lv on lv.lesson_id = l.id
where lv.status in ('published', 'draft')
order by l.position desc, lv.version desc
limit 15;
