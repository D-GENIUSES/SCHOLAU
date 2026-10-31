-- Practice and review feedback include the correct option's working, not only the final explanation.
do $$ declare definition text; begin
  select pg_get_functiondef('private.attempt_payload(uuid)'::regprocedure) into definition;
  if definition is null then raise exception 'attempt_payload missing'; end if;
  if position('''steps''' in definition) = 0 then
    if position('''explanation'', q.explanation) else null end' in definition) = 0 then
      raise exception 'attempt feedback marker missing';
    end if;
    definition := replace(definition,
      $old$'explanation', q.explanation) else null end$old$,
      $new$'explanation', q.explanation,
                   'steps', coalesce((select to_jsonb(o.steps) from public.question_options o where o.id = q.correct_option_id and o.question_version_id = q.question_version_id), '[]'::jsonb)) else null end$new$);
    execute definition;
  end if;

  select pg_get_functiondef('public.check_review_answer_v1(uuid,uuid,uuid,uuid)'::regprocedure) into definition;
  if definition is null then raise exception 'check_review_answer_v1 missing'; end if;
  if position('''steps''' in definition) = 0 then
    if position('''explanation'', v_key.explanation)' in definition) = 0 then
      raise exception 'review feedback marker missing';
    end if;
    definition := replace(definition,
      $old$'explanation', v_key.explanation)$old$,
      $new$'explanation', v_key.explanation,
    'steps', coalesce((select to_jsonb(o.steps) from public.question_options o where o.id = v_key.correct_option_id), '[]'::jsonb))$new$);
    execute definition;
  end if;
end $$;
