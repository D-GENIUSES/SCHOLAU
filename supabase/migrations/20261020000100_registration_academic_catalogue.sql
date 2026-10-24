-- Official department list: https://adelekeuniversity.edu.ng/faculty-of-science/
-- Preserve existing department IDs and their curriculum/enrollment relationships.
insert into public.departments(university_id,faculty_id,name,active)
select f.university_id,f.id,n.name,true from public.faculties f join public.universities u on u.id=f.university_id
cross join (values ('Biological Science'),('Biochemistry'),('Cybersecurity'),('Chemistry'),('Computer Science'),
 ('Microbiology'),('Computer Information System'),('Information Technology'),('Mathematics'),('Physics'),('Software Engineering')) n(name)
where u.slug='adeleke-university-ede-osun-state' and f.name='Faculty of Science'
on conflict(faculty_id,name) do update set active=true;

-- Only public academic catalogue data, available before creating an account.
create or replace function public.get_registration_options_v1(p_university_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object(
 'university_id',u.id,
 'faculties',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name) order by f.name) from public.faculties f where f.university_id=u.id and f.active),'[]'::jsonb),
 'departments',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'faculty_id',d.faculty_id,'name',d.name) order by d.name) from public.departments d join public.faculties f on f.id=d.faculty_id where d.university_id=u.id and d.active and f.active),'[]'::jsonb),
 'levels',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'label',l.label) order by l.sort_order) from public.levels l where l.university_id=u.id and l.active),'[]'::jsonb),
 'academic_periods',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'label',a.label) order by a.starts_on desc) from public.academic_periods a where a.university_id=u.id and a.active),'[]'::jsonb),
 'semesters',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'academic_period_id',s.academic_period_id,'label',s.label) order by s.sort_order) from public.semesters s join public.academic_periods a on a.id=s.academic_period_id where s.university_id=u.id and s.active and a.active),'[]'::jsonb)
) from public.universities u where u.slug=p_university_slug and u.active;
$$;
revoke all on function public.get_registration_options_v1(text) from public;
grant execute on function public.get_registration_options_v1(text) to anon,authenticated;

create or replace function private.initialize_registration_academic()
returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb:=new.raw_user_meta_data->'academic_profile'->'catalogProfile'; k text;
begin
 if v is null or jsonb_typeof(v)<>'object' then return new; end if;
 -- Run after account/role creation. Never overwrite an existing academic profile.
 if not exists(select 1 from public.profiles p where p.id=new.id and p.university_id is null)
  or not exists(select 1 from public.user_roles r where r.user_id=new.id and r.role='student') then return new; end if;
 foreach k in array array['universityId','facultyId','departmentId','levelId','academicPeriodId','semesterId'] loop
  if coalesce(v->>k,'') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' then return new; end if;
 end loop;
 -- User metadata supplies selections, never permissions. Validate every relationship.
 if not exists(select 1 from public.universities u
  join public.faculties f on f.university_id=u.id and f.id=(v->>'facultyId')::uuid and f.active
  join public.departments d on d.university_id=u.id and d.faculty_id=f.id and d.id=(v->>'departmentId')::uuid and d.active
  join public.levels l on l.university_id=u.id and l.id=(v->>'levelId')::uuid and l.active
  join public.academic_periods a on a.university_id=u.id and a.id=(v->>'academicPeriodId')::uuid and a.active
  join public.semesters s on s.university_id=u.id and s.academic_period_id=a.id and s.id=(v->>'semesterId')::uuid and s.active
  where u.id=(v->>'universityId')::uuid and u.active and u.slug=new.raw_user_meta_data->'academic_profile'->>'universitySlug') then return new; end if;
 perform private.apply_academic_profile(new.id,new.id,(v->>'universityId')::uuid,(v->>'facultyId')::uuid,
  (v->>'departmentId')::uuid,(v->>'levelId')::uuid,(v->>'academicPeriodId')::uuid,(v->>'semesterId')::uuid,
  'initial',null,null);
 return new;
end $$;
revoke all on function private.initialize_registration_academic() from public,anon,authenticated;
-- PostgreSQL orders same-event triggers by name: on_auth_user_created runs first.
drop trigger if exists zz_initialize_registration_academic on auth.users;
create trigger zz_initialize_registration_academic after insert on auth.users
for each row execute function private.initialize_registration_academic();
