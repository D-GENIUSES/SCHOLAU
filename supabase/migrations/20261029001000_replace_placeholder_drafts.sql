-- Fill-in-gap questions use gap_answers, not MCQ options; align publish validation with import rules.

create or replace function private.publish_question_version(p_version_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.question_versions;
  q public.questions;
  v_options integer;
  v_field jsonb := '{}'::jsonb;
begin
  select * into v from public.question_versions where id = p_version_id for update;
  if not found then
    perform private.raise_error('NOT_FOUND', 'Question version not found.');
  end if;
  if v.status = 'published' then
    return jsonb_build_object('entity_type', 'question_version', 'id', v.id, 'status', v.status, 'already_published', true);
  end if;
  if v.status <> 'draft' then
    perform private.raise_error('INVALID_STATE', 'Retired versions cannot be republished; create a new draft.');
  end if;
  if not private.user_is_admin(p_actor_id) then
    perform private.raise_error('FORBIDDEN', 'A reviewer with admin role is required.');
  end if;
  select * into q from public.questions where id = v.question_id;

  if v.answer_format = 'fill_in_gap' then
    if not exists (
      select 1
      from private.question_answer_keys k
      where k.question_version_id = v.id
        and jsonb_typeof(k.gap_answers) = 'array'
        and jsonb_array_length(k.gap_answers) >= 1
        and exists (
          select 1
          from jsonb_array_elements(k.gap_answers) g
          where jsonb_typeof(g -> 'accepted_answers') = 'array'
            and jsonb_array_length(g -> 'accepted_answers') >= 1
        )
    ) then
      v_field := v_field || jsonb_build_object('gap_answers', 'at least one gap with accepted answers required');
    end if;
  else
    select count(*) into v_options from public.question_options where question_version_id = v.id;
    if q.pool = 'battle' and v_options <> 4 then
      v_field := v_field || jsonb_build_object('options', 'Battles require exactly four options.');
    end if;
    if q.pool = 'battle' and v.answer_format = 'worked_solution' and exists (
      select 1 from public.question_options o where o.question_version_id = v.id and cardinality(o.steps) = 0
    ) then
      v_field := v_field || jsonb_build_object('steps', 'Each solution must include its calculation steps.');
    end if;
    if v_options < 2 then
      v_field := v_field || jsonb_build_object('options', 'at least two options required');
    end if;
    if not exists (
      select 1 from private.question_answer_keys k
      where k.question_version_id = v.id and k.correct_option_id is not null
    ) then
      v_field := v_field || jsonb_build_object('correct_option', 'exactly one answer key required');
    end if;
  end if;

  if coalesce(length(btrim(v.source_reference)), 0) = 0 then
    v_field := v_field || jsonb_build_object('source_reference', 'required');
  end if;
  if q.pool = 'battle' and v.usage <> array['battle']::text[] then
    v_field := v_field || jsonb_build_object('usage', 'battle-pool questions must have usage [battle] only');
  end if;
  if q.pool = 'learning' and 'battle' = any (v.usage) then
    v_field := v_field || jsonb_build_object('usage', 'learning-pool questions cannot be used in battles');
  end if;
  if q.lesson_id is not null and not exists (select 1 from public.lessons l where l.id = q.lesson_id and l.course_id = q.course_id) then
    v_field := v_field || jsonb_build_object('lesson_id', 'lesson belongs to a different course');
  end if;
  if v_field <> '{}'::jsonb then
    perform private.raise_error('VALIDATION_FAILED', 'Question version failed publish validation.', v_field);
  end if;

  perform set_config('scholau.allow_publish', 'on', true);
  update public.question_versions
     set status = 'retired', retired_at = now(), retired_by = p_actor_id, retired_reason = 'superseded'
   where question_id = v.question_id and status = 'published';
  update public.question_versions
     set status = 'published', reviewed_by = coalesce(reviewed_by, p_actor_id), published_at = now()
   where id = p_version_id;
  perform set_config('scholau.allow_publish', 'off', true);
  return jsonb_build_object('entity_type', 'question_version', 'id', v.id, 'status', 'published', 'already_published', false);
end;
$$;

-- Preserve authored calculation steps when importing worked-solution options.
do $steps$
declare definition text; changed text;
begin
 select pg_get_functiondef('public.admin_import_questions_v1(jsonb,boolean,uuid)'::regprocedure) into definition;
 changed:=replace(definition,'insert into public.question_options (question_version_id, label, body, position)',
  'insert into public.question_options (question_version_id, label, body, position, steps)');
 changed:=replace(changed,$old$values (v_version_id, v_opt->>'label', v_opt->>'body', v_n)$old$,
  $new$values (v_version_id, v_opt->>'label', v_opt->>'body', v_n, array(select jsonb_array_elements_text(coalesce(v_opt->'steps','[]'::jsonb))))$new$);
 if changed=definition then raise exception 'Worked-solution importer shape changed; review before applying'; end if;
 execute changed;
end $steps$;


-- Remove precisely the nine reviewed fallback drafts from the active review queue.
-- Retain the version records and answer keys as an audit archive.
do $cleanup$
declare actor uuid; removed integer;
begin
 select user_id into actor from public.user_roles where role='admin' order by user_id limit 1;
 if actor is null then raise exception 'An administrator is required'; end if;
 if (select count(*) from public.question_versions where id=any(array['b73230cd-104c-4046-913e-50f05104959a'::uuid,'86df14ea-9e1a-440e-998a-15a2f442cbb9'::uuid,'4d4c6657-3748-4af2-9bd5-dd6fb44b217d'::uuid,'34139b0c-eb5b-4977-8b95-ee5cf9f26a15'::uuid,'52b2dd5c-10f1-4497-8872-adaa1079aa6a'::uuid,'07797d98-e3d2-423e-8ede-18fce7e76c32'::uuid,'e3592860-b2ca-4a5d-be0b-74a796701142'::uuid,'7293e9cd-0c22-4527-b46e-768488142e51'::uuid,'bd04e930-d31b-4230-a4e7-e0991bc0da05'::uuid]) and status='draft'
   and prompt in ('Which statement best matches the main idea of this upload?','What should you do after studying this upload?','Fill in the blank: The main topic of this upload is _____.')) <> 9 then
   raise exception 'The nine audited drafts have changed; re-review before replacing them';
 end if;
 perform set_config('scholau.allow_publish','on',true);
 update public.question_versions set status='retired',retired_at=now(),retired_by=actor,
   retired_reason='Replaced generic ingestion fallback drafts with reviewed source-specific content'
 where id=any(array['b73230cd-104c-4046-913e-50f05104959a'::uuid,'86df14ea-9e1a-440e-998a-15a2f442cbb9'::uuid,'4d4c6657-3748-4af2-9bd5-dd6fb44b217d'::uuid,'34139b0c-eb5b-4977-8b95-ee5cf9f26a15'::uuid,'52b2dd5c-10f1-4497-8872-adaa1079aa6a'::uuid,'07797d98-e3d2-423e-8ede-18fce7e76c32'::uuid,'e3592860-b2ca-4a5d-be0b-74a796701142'::uuid,'7293e9cd-0c22-4527-b46e-768488142e51'::uuid,'bd04e930-d31b-4230-a4e7-e0991bc0da05'::uuid]) and status='draft';
 get diagnostics removed=row_count;
 perform set_config('scholau.allow_publish','off',true);
 perform private.audit(actor,'retire_fallback_drafts','question_import',null,gen_random_uuid(),
   'User requested replacement of nine incorrect extraction drafts',jsonb_build_object('count',removed));
end $cleanup$;
