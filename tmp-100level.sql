select c.code, c.title, count(distinct l.id) as published_lessons
from public.courses c
join public.course_offerings o on o.course_id=c.id and o.status='published'
join public.levels lv on lv.id=o.level_id and lv.label='100 Level'
join public.lessons l on l.course_id=c.id
join public.lesson_versions v on v.lesson_id=l.id and v.status='published'
where c.active
group by c.code, c.title
order by c.code;
