-- Remaining Philosophy of Education battle questions for the shared course AUE-GST 201.
-- Hosted already published poe-battle-01 through poe-battle-24. A fresh replay of
-- 20261024000700 publishes a full keyed pool through poe-battle-44. This migration
-- therefore adds only stems that are not already battles, and it skips a stem that
-- exists under either set. Correct answers stay the keyed learning answers.
-- The fourth option is a real wrong answer already named in the same notes.

do $migration$
declare
  v_course uuid;
  v_reviewer uuid;
  v_source text := 'GES 201 Philosophy of Education 2023/2024 FOS quiz handwritten answer key';
  v_row jsonb;
  v_opt record;
  v_question uuid;
  v_version uuid;
  v_option uuid;
  v_correct uuid;
  v_learning_version uuid;
  v_learning_lesson uuid;
  v_learning_difficulty text;
  v_learning_prompt text;
  v_learning_explanation text;
  v_learning_correct text;
  v_expected text;
  v_label text;
  v_body text;
  v_questions jsonb := $questions$[
    {"key":"poe-battle-45","source":"poe-learn-12","lesson":1,"difficulty":"beginner","correct":"A","prompt":"Education is not merely the accumulation of which of these?","explanation":"Education is not merely the accumulation of knowledge and facts.","options":["Knowledge and facts","Real life experiences and self-directed learning","Formal, informal and non-formal education","Knowledge, skills and understanding"]},
    {"key":"poe-battle-46","source":"poe-learn-15","lesson":1,"difficulty":"beginner","correct":"B","prompt":"What should empower individuals to question, explore and discover knowledge for themselves?","explanation":"Education should empower individuals to question, explore and discover knowledge for themselves.","options":["Social transformation","Education","Informal education","Philosophy"]},
    {"key":"poe-battle-47","source":"poe-learn-09","lesson":2,"difficulty":"beginner","correct":"B","prompt":"Education is from which of these?","explanation":"Education is from birth to death.","options":["Infancy to death","Birth to death","Head, heart and hand","Knowledge, values and ability"]},
    {"key":"poe-battle-48","source":"poe-learn-11","lesson":2,"difficulty":"beginner","correct":"A","prompt":"Education plays a crucial role in shaping which of these?","explanation":"Education plays a crucial role in shaping knowledge, values and ability.","options":["Knowledge, values and ability","Feelings, emotions and attitude","Head, heart and hand","Knowledge, skills and understanding"]},
    {"key":"poe-battle-49","source":"poe-learn-17","lesson":2,"difficulty":"beginner","correct":"B","prompt":"The universality of education can be seen in which structure of education?","explanation":"The universality of education can be seen in the traditional structure of education.","options":["Formal","Traditional","Informal","Non-formal"]},
    {"key":"poe-battle-50","source":"poe-learn-19","lesson":2,"difficulty":"beginner","correct":"B","prompt":"Traditionally, informal education for an individual begins in which period and continues until which point?","explanation":"Traditionally, informal education begins in infancy and continues until death.","options":["Birth and death","Infancy and death","Knowledge and facts","1956 and 1964"]},
    {"key":"poe-battle-51","source":"poe-learn-22","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Education is the most effective tool for which of these?","explanation":"Education is the most effective tool for social transformation.","options":["The love of wisdom","Social transformation","The pursuit of wisdom","Socialisation"]},
    {"key":"poe-battle-52","source":"poe-learn-25","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Which source defines philosophy as the pursuit of wisdom?","explanation":"Merriam-Webster Dictionary defines philosophy as the pursuit of wisdom.","options":["UNESCO, as cited by Umar (2014)","Merriam-Webster Dictionary","Benjamin Bloom (1956)","Immanuel Kant"]},
    {"key":"poe-battle-53","source":"poe-learn-27","lesson":4,"difficulty":"beginner","correct":"B","prompt":"All human beings by nature stretch themselves out toward which of these?","explanation":"All human beings by nature stretch themselves out toward knowing.","options":["The love of wisdom","Knowing","Logic","The pursuit of wisdom"]},
    {"key":"poe-battle-54","source":"poe-learn-28","lesson":4,"difficulty":"beginner","correct":"A","prompt":"Which branch of philosophy is concerned with the principles of reasoning and valid argumentation?","explanation":"Logic, a branch of philosophy, is concerned with the principles of reasoning and valid argumentation.","options":["Logic","The love of wisdom","The pursuit of wisdom","Behaviourist theory of learning"]},
    {"key":"poe-battle-55","source":"poe-learn-67","lesson":5,"difficulty":"beginner","correct":"B","prompt":"Which cognitive category is understanding the meaning of what is known?","explanation":"Comprehension is understanding the meaning of what is known.","options":["Knowledge","Comprehension","Analysis","Application"]},
    {"key":"poe-battle-56","source":"poe-learn-68","lesson":5,"difficulty":"beginner","correct":"A","prompt":"Which cognitive category is the ability to utilise an abstraction or to use knowledge in a new situation?","explanation":"Application is the ability to utilise an abstraction or to use knowledge in a new situation.","options":["Application","Analysis","Synthesis","Comprehension"]},
    {"key":"poe-battle-57","source":"poe-learn-69","lesson":5,"difficulty":"beginner","correct":"A","prompt":"Which cognitive category is the ability to differentiate facts and opinions?","explanation":"Analysis is the ability to differentiate facts and opinions.","options":["Analysis","Evaluation","Knowledge","Synthesis"]},
    {"key":"poe-battle-58","source":"poe-learn-70","lesson":5,"difficulty":"intermediate","correct":"A","prompt":"Which cognitive category integrates elements to form a structure and establish a new meaning?","explanation":"Synthesis integrates elements to form a sound pattern or structure to establish a new meaning.","options":["Synthesis","Application","Comprehension","Evaluation"]},
    {"key":"poe-battle-59","source":"poe-learn-71","lesson":5,"difficulty":"intermediate","correct":"A","prompt":"Which cognitive category is the ability to come up with judgements about the importance of concepts?","explanation":"Evaluation is the ability to come up with judgements about the importance of concepts.","options":["Evaluation","Analysis","Synthesis","Application"]},
    {"key":"poe-battle-60","source":"poe-learn-73","lesson":5,"difficulty":"intermediate","correct":"B","prompt":"The affective domain is categorised into which sub-domains?","explanation":"The affective domain has five sub-domains: receiving, responding, valuing, organisation and characterisation.","options":["Three: cognitive, affective and psychomotor","Five: receiving, responding, valuing, organisation and characterisation","Six: perception, set, guided response, mechanism, adaptation and origination","Six: knowledge, comprehension, application, analysis, synthesis and evaluation"]},
    {"key":"poe-battle-61","source":"poe-learn-75","lesson":5,"difficulty":"intermediate","correct":"B","prompt":"Which categories are under the psychomotor domain?","explanation":"There are six psychomotor categories: perception, set, guided response, mechanism, adaptation and origination.","options":["Five: receiving, responding, valuing, organisation and characterisation","Six: perception, set, guided response, mechanism, adaptation and origination","Six: knowledge, comprehension, application, analysis, synthesis and evaluation","Three: cognitive, affective and psychomotor"]},
    {"key":"poe-battle-62","source":"poe-learn-76","lesson":6,"difficulty":"beginner","correct":"A","prompt":"Which field of psychology is concerned with individual behaviour?","explanation":"Behaviourist theory of learning is a field of psychology concerned with individual behaviour.","options":["Behaviourist theory of learning","Bloom's taxonomy","Informal education","Logic"]},
    {"key":"poe-battle-63","source":"poe-learn-78","lesson":6,"difficulty":"beginner","correct":"B","prompt":"How many critical assumptions underpin the behaviourist view of learning?","explanation":"Three critical assumptions underpin the behaviourist view of learning. The key states the number and does not list the assumptions.","options":["Two","Three","Four","Five"]},
    {"key":"poe-battle-64","source":"poe-learn-80","lesson":6,"difficulty":"intermediate","correct":"B","prompt":"Who presents four fundamental principles of the behaviourist model of learning?","explanation":"James Hartley presents four fundamental principles of the behaviourist model of learning. The key does not list the four principles.","options":["Skinner (1953, 1968)","James Hartley","Benjamin Bloom (1956)","Immanuel Kant"]}
  ]$questions$;
begin
  if jsonb_array_length(v_questions) <> 20 then
    raise exception 'expected 20 additional Philosophy of Education battle questions';
  end if;

  select id into v_course from public.courses where code = 'AUE-GST 201';
  if v_course is null or (select count(*) from public.courses where code = 'AUE-GST 201') <> 1 then
    raise exception 'AUE-GST 201 must be exactly one shared course';
  end if;

  select ur.user_id into v_reviewer
  from public.user_roles ur
  where ur.role = 'admin'
  order by ur.granted_at
  limit 1;
  if v_reviewer is null then
    select p.id into v_reviewer from public.profiles p order by p.created_at limit 1;
  end if;
  if v_reviewer is null then
    raise exception 'AUE-GST 201 battle questions need a reviewer to publish';
  end if;

  perform set_config('scholau.allow_publish', 'on', true);

  for v_row in select value from jsonb_array_elements(v_questions) loop
    if exists (
      select 1 from public.questions
      where course_id = v_course and logical_key = v_row ->> 'key'
    ) then
      continue;
    end if;
    if exists (
      select 1
      from public.questions q
      join public.question_versions qv on qv.question_id = q.id
      where q.course_id = v_course
        and q.pool = 'battle'
        and qv.prompt = btrim(v_row ->> 'prompt')
    ) then
      continue;
    end if;
    if jsonb_array_length(v_row -> 'options') <> 4
       or upper(btrim(v_row ->> 'correct')) not in ('A', 'B', 'C') then
      raise exception 'battle question % must keep the keyed answer among four options', v_row ->> 'key';
    end if;
    if (
      select count(*)
      from (
        select btrim(value) as body
        from jsonb_array_elements_text(v_row -> 'options')
      ) bodies
      group by body
      having count(*) > 1
         or coalesce(length(body), 0) not between 1 and 1000
    ) > 0 then
      raise exception 'battle question % has a blank or repeated option', v_row ->> 'key';
    end if;

    select q.lesson_id, qv.id, qv.difficulty, qv.prompt, k.explanation, o.body
      into v_learning_lesson, v_learning_version, v_learning_difficulty, v_learning_prompt, v_learning_explanation, v_learning_correct
    from public.questions q
    join public.lessons l on l.id = q.lesson_id
    join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
    join private.question_answer_keys k on k.question_version_id = qv.id
    join public.question_options o on o.id = k.correct_option_id
    where q.course_id = v_course
      and q.pool = 'learning'
      and q.logical_key = v_row ->> 'source'
      and l.position = (v_row ->> 'lesson')::integer;
    if not found then
      raise exception 'learning source % was not found on its chapter', v_row ->> 'source';
    end if;
    if v_learning_prompt is distinct from btrim(v_row ->> 'prompt')
       or v_learning_difficulty is distinct from v_row ->> 'difficulty'
       or v_learning_explanation is distinct from btrim(v_row ->> 'explanation') then
      raise exception 'battle % does not match its learning question', v_row ->> 'key';
    end if;
    if (select count(*) from public.question_options where question_version_id = v_learning_version) <> 3 then
      raise exception 'learning source % is not a three-option question', v_row ->> 'source';
    end if;
    if (
      select count(*)
      from jsonb_array_elements(v_row -> 'options') with ordinality as n(elem, ord)
      join public.question_options lo
        on lo.question_version_id = v_learning_version
       and lo.position = n.ord::integer
       and lo.body = btrim(n.elem #>> '{}')
      where n.ord <= 3
    ) <> 3 then
      raise exception 'battle % changed a keyed learning option', v_row ->> 'key';
    end if;

    v_expected := btrim(v_row -> 'options' ->> (ascii(upper(btrim(v_row ->> 'correct'))) - 65));
    if v_expected is distinct from v_learning_correct then
      raise exception 'battle % changed the correct answer', v_row ->> 'key';
    end if;

    insert into public.questions (course_id, lesson_id, pool, logical_key)
    values (v_course, v_learning_lesson, 'battle', v_row ->> 'key')
    returning id into v_question;
    insert into public.question_versions (
      question_id, version, prompt, difficulty, usage, source_reference, status, reviewed_by, published_at, answer_format
    ) values (
      v_question,
      1,
      btrim(v_row ->> 'prompt'),
      v_row ->> 'difficulty',
      array['battle']::text[],
      v_source,
      'draft',
      null,
      null,
      'standard'
    ) returning id into v_version;

    v_correct := null;
    for v_opt in
      select t.elem, t.ord
      from jsonb_array_elements(v_row -> 'options') with ordinality as t(elem, ord)
    loop
      v_label := chr(64 + v_opt.ord::integer);
      v_body := btrim(v_opt.elem #>> '{}');
      insert into public.question_options (question_version_id, label, body, position)
      values (v_version, v_label, v_body, v_opt.ord::integer)
      returning id into v_option;
      if v_label = upper(btrim(v_row ->> 'correct')) then
        v_correct := v_option;
      end if;
    end loop;
    if v_correct is null then
      raise exception 'question % correct option does not match a label', v_row ->> 'key';
    end if;
    insert into private.question_answer_keys (question_version_id, correct_option_id, explanation)
    values (v_version, v_correct, btrim(v_row ->> 'explanation'));
    update public.question_versions
       set status = 'published', reviewed_by = v_reviewer, published_at = now()
     where id = v_version;
  end loop;

  if (
    select count(*)
    from jsonb_array_elements(v_questions) r
    where not exists (
      select 1
      from public.questions q
      join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
      where q.course_id = v_course
        and q.pool = 'battle'
        and qv.prompt = btrim(r.value ->> 'prompt')
        and qv.usage = array['battle']::text[]
        and qv.answer_format = 'standard'
        and (select count(*) from public.question_options o where o.question_version_id = qv.id) = 4
    )
  ) <> 0 then
    raise exception 'a Philosophy of Education battle stem is still missing';
  end if;
  if (
    select count(*)
    from public.questions
    where course_id = v_course and pool = 'battle' and logical_key like 'poe-battle-%'
  ) <> 44 then
    raise exception 'Philosophy of Education battle pool is not 44 questions';
  end if;

  perform set_config('scholau.allow_publish', 'off', true);
end
$migration$;
