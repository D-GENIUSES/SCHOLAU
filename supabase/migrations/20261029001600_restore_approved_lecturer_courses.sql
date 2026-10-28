-- Restore catalogue matches for legacy approvals made before automatic assignment.
-- Never override existing assignments or a recorded administrator assignment edit.
lock table public.lecturer_course_assignments in share row exclusive mode;
do $$
declare a public.lecturer_applications; ids uuid[]; request_id uuid; affected integer;
begin
 for a in select x.* from public.lecturer_applications x
 join public.profiles p on p.id=x.user_id and p.deactivated_at is null
 join auth.users u on u.id=x.user_id and u.email_confirmed_at is not null
 where x.status='approved'
 and exists(select 1 from public.user_roles r where r.user_id=x.user_id and r.role='lecturer')
 and not exists(select 1 from public.lecturer_course_assignments c where c.user_id=x.user_id)
 and not exists(select 1 from private.lecturer_application_reviews r where r.application_id=x.id and r.action='courses_assigned')
 order by x.id for update of x
 loop
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(private.lecturer_requested_assignment_plan(a.id)->'offering_ids');
  if coalesce(cardinality(ids),0) not between 1 and 100 then continue; end if;
  request_id:=gen_random_uuid();
  insert into public.lecturer_course_assignments(user_id,offering_id,assigned_by)
  select a.user_id,id,null from unnest(ids) id on conflict do nothing;
  get diagnostics affected=row_count;
  if affected=0 then continue; end if;
  update public.lecturer_applications set revision=revision+1,updated_at=now() where id=a.id;
  insert into private.lecturer_application_reviews(application_id,actor_id,action,internal_note,request_key)
  values(a.id,null,'courses_assigned','System reconciliation: assigned catalogue courses requested in an existing approved application. No previous assignment edit was recorded.',request_id);
  perform private.audit(null,'restore_approved_lecturer_courses','lecturer_application',a.id,request_id,
   'Reconcile approval before automatic course assignment',jsonb_build_object('assigned_count',affected));
  insert into public.notifications(user_id,kind,body,safe_target,event_key)
  values(a.user_id,'lecturer_courses_assigned','Your approved teaching courses are ready. Open My courses to view students and create challenges.','/lecturer','legacy-lecturer-courses:'||a.id::text)
  on conflict(event_key) do nothing;
 end loop;
end $$;
