create or replace function public.get_student_course_request_options_v1(p_search text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_profile public.profiles; v_level_order integer;
begin
 select * into v_profile from public.profiles where id=v_uid;
 select sort_order into v_level_order from public.levels where id=v_profile.level_id;
 return private.envelope(jsonb_build_object('courses', coalesce((select jsonb_agg(jsonb_build_object(
   'offering_id',o.id,'course_id',c.id,'code',c.code,'title',c.title,
   'level',coalesce(l.label,''),'semester',coalesce(s.label,''),'period',coalesce(ap.label,'')) order by c.code,l.sort_order)
   from public.course_offerings o join public.courses c on c.id=o.course_id
   left join public.levels l on l.id=o.level_id left join public.semesters s on s.id=o.semester_id
   left join public.academic_periods ap on ap.id=s.academic_period_id
   where o.status='published' and c.active and o.university_id=v_profile.university_id and o.department_id=v_profile.department_id
     and o.semester_id=v_profile.semester_id and l.sort_order < coalesce(v_level_order,0)
     and not exists(select 1 from public.enrollments e where e.user_id=v_uid and e.offering_id=o.id and e.ended_at is null)
     and not exists(select 1 from public.course_requests r where r.user_id=v_uid and r.offering_id=o.id and r.status='pending')
     and (p_search is null or btrim(p_search)='' or lower(c.code||' '||c.title) like '%'||lower(btrim(p_search))||'%')), '[]'::jsonb),
   'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'offering_id',r.offering_id,'status',r.status,'code',c.code,'title',c.title,'created_at',r.created_at) order by r.created_at desc)
     from public.course_requests r join public.course_offerings o on o.id=r.offering_id join public.courses c on c.id=o.course_id where r.user_id=v_uid), '[]'::jsonb)));
end; $$;
