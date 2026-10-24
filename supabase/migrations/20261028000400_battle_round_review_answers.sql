-- Finished battles: expose gap keys and typed answers in round review (MCQ keys already ship in rounds).
do $$ declare definition text; begin
  select pg_get_functiondef('private.battle_payload(uuid,uuid)'::regprocedure) into definition;
  if definition is null then raise exception 'battle_payload missing'; end if;
  if strpos(definition, '''my_text_answer'', mine.text_answer') = 0 then
    if strpos(definition, '''explanation'', (select k.explanation from private.question_answer_keys k where k.question_version_id=qv.id),') > 0 then
      definition := replace(definition,
        $old$'explanation', (select k.explanation from private.question_answer_keys k where k.question_version_id=qv.id),
        'my_is_correct', coalesce(mine.is_correct, false),$old$,
        $new$'explanation', (select k.explanation from private.question_answer_keys k where k.question_version_id=qv.id),
        'my_text_answer', mine.text_answer,
        'answer_format', qv.answer_format,
        'gap_answers', (select k.gap_answers from private.question_answer_keys k where k.question_version_id = qv.id),
        'my_is_correct', coalesce(mine.is_correct, false),$new$);
    else
      definition := replace(definition,
        $old$'my_option_id', mine.option_id,
        'my_is_correct', coalesce(mine.is_correct, false),$old$,
        $new$'my_option_id', mine.option_id,
        'my_text_answer', mine.text_answer,
        'answer_format', qv.answer_format,
        'gap_answers', (select k.gap_answers from private.question_answer_keys k where k.question_version_id = qv.id),
        'my_is_correct', coalesce(mine.is_correct, false),$new$);
    end if;
  end if;
  execute definition;
end $$;
