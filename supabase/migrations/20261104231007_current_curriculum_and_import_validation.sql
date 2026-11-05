begin;
-- An explicitly inactive curriculum row supersedes the legacy offering; keep its
-- identity/history available while hiding it from new selection and assignment.
create function private.curriculum_offering_current(p_offering uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select cc.active from public.course_offerings o
    join public.semesters s on s.id=o.semester_id
    join public.curriculum_courses cc on cc.department_id=o.department_id
      and cc.level_id=o.level_id and cc.semester_number=s.sort_order and cc.course_id=o.course_id
    where o.id=p_offering),true)
$$;
revoke all on function private.curriculum_offering_current(uuid) from public,anon,authenticated,service_role;
do $migration$
declare definition text; extra text;
begin
  definition:=pg_get_functiondef('public.get_catalog_v1()'::regprocedure);
  if position('where o.status = ''published'' and c.active' in definition)=0 then raise exception 'Catalog anchor missing'; end if;
  definition:=replace(definition,'where o.status = ''published'' and c.active',
    'where o.status = ''published'' and c.active and private.curriculum_offering_current(o.id)');
  execute definition;
  definition:=pg_get_functiondef('private.assign_required_courses(uuid)'::regprocedure);
  if position('and o.status=''published''' in definition)=0 then raise exception 'Auto-assignment anchor missing'; end if;
  definition:=replace(definition,'and o.status=''published''',
    'and o.status=''published'' and private.curriculum_offering_current(o.id)');
  execute definition;
  definition:=pg_get_functiondef('public.enroll_course_v1(uuid,uuid)'::regprocedure);
  if position('if not found or v_offering.status <> ''published''' in definition)=0 then raise exception 'Enrollment anchor missing'; end if;
  definition:=replace(definition,'if not found or v_offering.status <> ''published''',
    'if not found or v_offering.status <> ''published'' or not private.curriculum_offering_current(v_offering.id)');
  execute definition;

  definition:=pg_get_functiondef('public.admin_import_questions_v1(jsonb,boolean,uuid)'::regprocedure);
  extra:=$validation$
        if length(v_key)>120 or (coalesce(v_row->>'course_code','')||'/'||v_key)=any(v_seen) then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','logical_question_key','message','Use a unique key of at most 120 characters');
        end if;
        v_seen:=v_seen||(coalesce(v_row->>'course_code','')||'/'||v_key);
        if v_pool not in ('learning','battle') then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','pool','message','must be learning or battle');
        end if;
        if cardinality(v_usage)=0 or not(v_usage <@ array['review','practice','mock','battle'])
          or (v_pool='battle' and v_usage<>array['battle']) or (v_pool='learning' and 'battle'=any(v_usage)) then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','usage','message','Usage must match the question pool');
        end if;
        if coalesce(v_row->>'difficulty','') not in ('beginner','intermediate','advanced') then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','difficulty','message','must be beginner/intermediate/advanced');
        end if;
        if v_format<>'fill_in_gap' then
          if exists(select 1 from jsonb_array_elements(v_options) o where coalesce(length(o->>'body'),0) not between 1 and 1000 or length(o->>'label')>4)
            or (select count(distinct o->>'label') from jsonb_array_elements(v_options) o)<>jsonb_array_length(v_options) then
            v_errors:=v_errors||jsonb_build_object('row',v_i,'field','options','message','Use unique labels and nonempty option text up to 1000 characters');
          end if;
          if not exists(select 1 from jsonb_array_elements(v_options) o where o->>'label'=v_correct) then
            v_errors:=v_errors||jsonb_build_object('row',v_i,'field','correct_option','message','must match an option label');
          end if;
        end if;
        if nullif(v_row->>'lesson_id','') is not null and (v_lesson is null or not exists(select 1 from public.lessons l where l.id=v_lesson and l.course_id=v_course)) then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','lesson_id','message','lesson not in course');
        end if;
        if exists(select 1 from public.questions q where q.course_id=v_course and q.logical_key=v_key and q.pool<>v_pool) then
          v_errors:=v_errors||jsonb_build_object('row',v_i,'field','pool','message','existing question has a different pool');
        end if;
$validation$;
  if position('if v_pass = 1 then' in definition)=0 then raise exception 'Importer anchor missing'; end if;
  definition:=replace(definition,'if v_pass = 1 then','if v_pass = 1 then'||extra);
  execute definition;
end $migration$;
commit;
