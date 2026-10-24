-- Philosophy of Education for the shared course AUE-GST 201.
-- Lessons and questions are stored on the course, so every published offering shows them.
-- Scored answers are taken from the handwritten GES 201 2023/2024 answer key.
-- Questions 29-51 are study prompts only. Questions 52-64 are omitted.
-- Quiz radio selections are not an answer key. Battle items use four real options from the key.

do $migration$
declare
  v_course uuid;
  v_reviewer uuid;
  v_publish boolean;
  v_source text := 'GES 201 Philosophy of Education 2023/2024 FOS quiz handwritten answer key';
  v_module uuid;
  v_lesson uuid;
  v_lesson_ids uuid[] := array[]::uuid[];
  v_row jsonb;
  v_opt record;
  v_errors text[];
  v_question uuid;
  v_version uuid;
  v_option uuid;
  v_correct uuid;
  v_label text;
  v_pool text;
  v_body text;
  v_lesson_pos integer;
  v_assessment uuid;
  v_assessment_version uuid;
  v_count integer;
  v_lessons jsonb := $lessons$[
    {
      "position": 1,
      "minutes": 8,
      "title": "Definitions and etymology of education",
      "objective": "Explain the etymology of education and distinguish it from the mere accumulation of facts.",
      "blocks": [
        {"type":"heading","level":2,"text":"Etymology"},
        {"type":"paragraph","text":"Etymologically, education is the act of leading or guiding someone towards knowledge and enlightenment. Education stems from the Latin words educare and educere, which mean to bring up, rear and raise."},
        {"type":"heading","level":2,"text":"What education is not"},
        {"type":"paragraph","text":"Education is not merely the accumulation of knowledge and facts. It is not limited to formal classroom settings. It can also be acquired through real life experiences and self-directed learning."},
        {"type":"callout","tone":"tip","text":"Education should empower individuals to question, explore and discover knowledge for themselves."},
        {"type":"checkpoint","question":"Etymologically, education is defined as which of these?","options":["The love of wisdom","The act of leading or guiding someone towards knowledge and enlightenment","The accumulation of knowledge and facts"],"correct_index":1,"explanation":"Etymologically, education is the act of leading or guiding someone towards knowledge and enlightenment."}
      ]
    },
    {
      "position": 2,
      "minutes": 8,
      "title": "UNESCO, domains and the three Hs",
      "objective": "State the UNESCO definition of education and recall the domains, the three Hs, and the traditional types of education.",
      "blocks": [
        {"type":"heading","level":2,"text":"UNESCO"},
        {"type":"paragraph","text":"According to UNESCO, education is organised and sustained instruction designed to communicate a combination of knowledge, skills and understanding valuable for all the activities of life (Umar, 2014)."},
        {"type":"paragraph","text":"Sound education should appeal to three domains: cognitive, affective and psychomotor. Education is from birth to death."},
        {"type":"heading","level":2,"text":"The three Hs"},
        {"type":"paragraph","text":"The three Hs of education are head, heart and hand. Education plays a crucial role in shaping knowledge, values and ability."},
        {"type":"heading","level":2,"text":"Traditional structure"},
        {"type":"paragraph","text":"The universality of education can be seen in the traditional structure of education. Traditional education had three types: formal, informal and non-formal. Traditionally, informal education for an individual begins in infancy and continues until death."},
        {"type":"checkpoint","question":"Which are the three Hs of education?","options":["Knowledge, values and ability","Cognitive, affective and psychomotor","Head, heart and hand"],"correct_index":2,"explanation":"The three Hs of education are head, heart and hand."}
      ]
    },
    {
      "position": 3,
      "minutes": 8,
      "title": "Philosophers on education",
      "objective": "Match each keyed definition of education to Dayananda, Gandhi, Aristotle, Ellen G. White, Socrates or Dewey.",
      "blocks": [
        {"type":"paragraph","text":"The handwritten key attributes these definitions to named thinkers. Learn the person with the wording."},
        {"type":"list","items":[
          "Dayananda, Swami (1824-1883) defined education as the formation of character.",
          "Gandhi, M.K. (1869-1948) defined education as the all-round drawing out of the best.",
          "Aristotle (384-322) defined education as the creation of a sound mind in a sound body.",
          "Ellen G. White (1824-1915) defined education as the harmonious development of the physical, mental and spiritual powers.",
          "Socrates defined education as the kindling of a flame, not the filling of a vessel. Socrates also defines education as midwifery for the soul.",
          "Dewey: education is not a preparation for life; it is life itself."
        ]},
        {"type":"checkpoint","question":"Who defined education as the kindling of a flame, not the filling of a vessel?","options":["Plato","Socrates","Aristotle"],"correct_index":1,"explanation":"Socrates defined education as the kindling of a flame, not the filling of a vessel."}
      ]
    },
    {
      "position": 4,
      "minutes": 10,
      "title": "Branches and the meaning of philosophy",
      "objective": "Recall how the key defines philosophy, its Greek roots, Kant's four questions, and logic as a branch of philosophy.",
      "blocks": [
        {"type":"paragraph","text":"Informal education is based on socialisation. Education is the most effective tool for social transformation."},
        {"type":"paragraph","text":"Philosophy is often referred to as the love of wisdom. It originates from two Greek words, philos and sophos. Merriam-Webster Dictionary defines philosophy as the pursuit of wisdom."},
        {"type":"paragraph","text":"According to the 18th-century philosopher Immanuel Kant, the task of philosophy is united by four questions: What can I know; What should I do; What may I hope for; What is a human being."},
        {"type":"paragraph","text":"All human beings by nature stretch themselves out toward knowing. Logic, a branch of philosophy, is concerned with the principles of reasoning and valid argumentation."},
        {"type":"heading","level":2,"text":"Prompts the key does not answer"},
        {"type":"callout","tone":"info","text":"These prompts are visible in the source notes. The handwritten key does not answer them, so they are study prompts and are not scored."},
        {"type":"list","items":[
          "Which field investigates the nature and scope of knowledge?",
          "Which field investigates theories of governance, justice, and the organization of society?",
          "Which field examines questions related to beauty, art, and the nature of aesthetic experience?",
          "Philosophy has how many modes or styles?",
          "Which kind of philosophy means to see things as a whole?",
          "Which view proposes that consciousness is a fundamental property of the universe?",
          "Which view suggests we are living in a computer simulation?",
          "Which view posits that consciousness is fundamentally separate from the physical body?",
          "Which view suggests that consciousness is an emergent property of the brain's complex interactions?",
          "Prescriptive philosophy means what?",
          "Epistemology explores questions related to which three areas?",
          "What does JTB mean?",
          "What is the title of Edmund Gettier's 1963 paper?",
          "A person's belief about reality, truth and values determines everything done in which two areas?",
          "Who noted that the crux of philosophy is asking the right questions?",
          "Philosophy interrogates issues of which three kinds?",
          "The principal aim of philosophy is derived from which Socratic concept?",
          "To do what is right, one must learn what?",
          "Which methods rely on the foundation of learning?",
          "Learning is an integral component of what?",
          "According to Ormrod (2008), which two things do humans do very well?",
          "As humans, which three things do we do?",
          "Who is considered the pioneer of contemporary research into learning?"
        ]},
        {"type":"checkpoint","question":"Merriam-Webster Dictionary defines philosophy as which of these?","options":["The love of wisdom","The pursuit of wisdom","Logic, a branch of philosophy"],"correct_index":1,"explanation":"Merriam-Webster Dictionary defines philosophy as the pursuit of wisdom. The key separately says philosophy is often referred to as the love of wisdom."}
      ]
    },
    {
      "position": 5,
      "minutes": 10,
      "title": "Bloom's taxonomy",
      "objective": "Recall the six cognitive categories, the affective domain, and the six psychomotor categories from the answer key.",
      "blocks": [
        {"type":"paragraph","text":"The answer key dates the cognitive domain to 1956, the affective domain to 1964, and the psychomotor domain to 1970. It attributes Bloom's taxonomy to Benjamin Bloom, 1956."},
        {"type":"heading","level":2,"text":"Cognitive domain"},
        {"type":"paragraph","text":"There are six categories under the cognitive domain: knowledge, comprehension, application, analysis, synthesis and evaluation."},
        {"type":"list","items":[
          "Knowledge is the ability to recall data and information.",
          "Comprehension is understanding the meaning of what is known.",
          "Application is the ability to utilise an abstraction or to use knowledge in a new situation.",
          "Analysis is the ability to differentiate facts and opinions.",
          "Synthesis integrates elements to form a sound pattern or structure to establish a new meaning.",
          "Evaluation is the ability to come up with judgements about the importance of concepts."
        ]},
        {"type":"heading","level":2,"text":"Affective domain"},
        {"type":"paragraph","text":"The affective domain involves feelings, emotions and attitude. It is categorised into five sub-domains: receiving, responding, valuing, organisation and characterisation."},
        {"type":"heading","level":2,"text":"Psychomotor domain"},
        {"type":"paragraph","text":"The psychomotor domain was thoroughly described in the 1970s. There are six categories: perception, set, guided response, mechanism, adaptation and origination."},
        {"type":"checkpoint","question":"Which category is the ability to recall data and information?","options":["Knowledge","Comprehension","Application"],"correct_index":0,"explanation":"Knowledge is the ability to recall data and information."}
      ]
    },
    {
      "position": 6,
      "minutes": 8,
      "title": "Behaviourism",
      "objective": "State Skinner's definition of learning and the two basic views named in the behaviourist answer key.",
      "blocks": [
        {"type":"paragraph","text":"Behaviourist theory of learning is a field of psychology concerned with individual behaviour."},
        {"type":"paragraph","text":"According to Skinner (1953, 1968), learning is an enduring change of behaviour resulting from external events."},
        {"type":"paragraph","text":"Three critical assumptions underpin the behaviourist view of learning. The key gives the number three and does not list the assumptions."},
        {"type":"paragraph","text":"There are two basic views in behaviourism: classical conditioning and operant conditioning."},
        {"type":"paragraph","text":"James Hartley presents four fundamental principles of the behaviourist model of learning. The key names Hartley and says there are four principles; it does not list those principles."},
        {"type":"callout","tone":"warning","text":"Do not invent the three behaviourist assumptions or Hartley's four principles. They are not written in the answer key."},
        {"type":"checkpoint","question":"According to the key, learning is an enduring change of behaviour resulting from external events. Who said this?","options":["Benjamin Bloom","Skinner (1953, 1968)","James Hartley"],"correct_index":1,"explanation":"Skinner (1953, 1968) describes learning as an enduring change of behaviour resulting from external events."}
      ]
    }
  ]$lessons$;
  v_questions jsonb := $questions$[
    {"key":"poe-learn-05","pool":"learning","lesson":1,"difficulty":"beginner","correct":"B","prompt":"Etymologically, education can be defined as which of these?","explanation":"Etymologically, education is the act of leading or guiding someone towards knowledge and enlightenment.","options":["The love of wisdom","The act of leading or guiding someone towards knowledge and enlightenment","The accumulation of knowledge and facts"]},
    {"key":"poe-learn-06","pool":"learning","lesson":1,"difficulty":"beginner","correct":"B","prompt":"Education stems from which Latin words, and what do they mean?","explanation":"Education stems from the Latin educare and educere, meaning to bring up, rear and raise.","options":["Philos and sophos, meaning the love of wisdom","Educare and educere, meaning to bring up, rear and raise","Head, heart and hand"]},
    {"key":"poe-learn-12","pool":"learning","lesson":1,"difficulty":"beginner","correct":"A","prompt":"Education is not merely the accumulation of which of these?","explanation":"Education is not merely the accumulation of knowledge and facts.","options":["Knowledge and facts","Real life experiences and self-directed learning","Formal, informal and non-formal education"]},
    {"key":"poe-learn-13","pool":"learning","lesson":1,"difficulty":"beginner","correct":"B","prompt":"Education is not limited to formal classroom settings but can also be acquired through which of these?","explanation":"Education can also be acquired through real life experiences and self-directed learning.","options":["Social transformation","Real life experiences and self-directed learning","Classical conditioning and operant conditioning"]},
    {"key":"poe-learn-15","pool":"learning","lesson":1,"difficulty":"beginner","correct":"B","prompt":"What should empower individuals to question, explore and discover knowledge for themselves?","explanation":"Education should empower individuals to question, explore and discover knowledge for themselves.","options":["Social transformation","Education","Informal education"]},
    {"key":"poe-learn-07","pool":"learning","lesson":2,"difficulty":"beginner","correct":"A","prompt":"According to UNESCO, education is which of these?","explanation":"According to UNESCO, education is organised and sustained instruction designed to communicate a combination of knowledge, skills and understanding valuable for all the activities of life (Umar, 2014).","options":["Organised and sustained instruction designed to communicate a combination of knowledge, skills and understanding valuable for all the activities of life (Umar, 2014)","The formation of character","The harmonious development of the physical, mental and spiritual powers"]},
    {"key":"poe-learn-08","pool":"learning","lesson":2,"difficulty":"beginner","correct":"B","prompt":"Sound education should appeal to which three domains?","explanation":"The three domains are cognitive, affective and psychomotor.","options":["Head, heart and hand","Cognitive, affective and psychomotor","Formal, informal and non-formal"]},
    {"key":"poe-learn-09","pool":"learning","lesson":2,"difficulty":"beginner","correct":"B","prompt":"Education is from which of these?","explanation":"Education is from birth to death.","options":["Infancy to death","Birth to death","Head, heart and hand"]},
    {"key":"poe-learn-10","pool":"learning","lesson":2,"difficulty":"beginner","correct":"C","prompt":"The three Hs of education are which of these?","explanation":"The three Hs of education are head, heart and hand.","options":["Knowledge, values and ability","Cognitive, affective and psychomotor","Head, heart and hand"]},
    {"key":"poe-learn-11","pool":"learning","lesson":2,"difficulty":"beginner","correct":"A","prompt":"Education plays a crucial role in shaping which of these?","explanation":"Education plays a crucial role in shaping knowledge, values and ability.","options":["Knowledge, values and ability","Feelings, emotions and attitude","Head, heart and hand"]},
    {"key":"poe-learn-17","pool":"learning","lesson":2,"difficulty":"beginner","correct":"B","prompt":"The universality of education can be seen in which structure of education?","explanation":"The universality of education can be seen in the traditional structure of education.","options":["Formal","Traditional","Informal"]},
    {"key":"poe-learn-18","pool":"learning","lesson":2,"difficulty":"beginner","correct":"B","prompt":"Traditional education had which three types?","explanation":"Traditional education had three types: formal, informal and non-formal.","options":["Cognitive, affective and psychomotor","Formal, informal and non-formal","Head, heart and hand"]},
    {"key":"poe-learn-19","pool":"learning","lesson":2,"difficulty":"beginner","correct":"B","prompt":"Traditionally, informal education for an individual begins in which period and continues until which point?","explanation":"Traditionally, informal education begins in infancy and continues until death.","options":["Birth and death","Infancy and death","Knowledge and facts"]},
    {"key":"poe-learn-01","pool":"learning","lesson":3,"difficulty":"beginner","correct":"A","prompt":"Who defined education as the formation of character?","explanation":"Dayananda, Swami (1824-1883) defined education as the formation of character.","options":["Dayananda, Swami (1824-1883)","Gandhi, M.K. (1869-1948)","Aristotle (384-322)"]},
    {"key":"poe-learn-02","pool":"learning","lesson":3,"difficulty":"beginner","correct":"B","prompt":"Who defined education as the all-round drawing out of the best?","explanation":"Gandhi, M.K. (1869-1948) defined education as the all-round drawing out of the best.","options":["Aristotle (384-322)","Gandhi, M.K. (1869-1948)","Ellen G. White (1824-1915)"]},
    {"key":"poe-learn-03","pool":"learning","lesson":3,"difficulty":"beginner","correct":"C","prompt":"Who defined education as the creation of a sound mind in a sound body?","explanation":"Aristotle (384-322) defined education as the creation of a sound mind in a sound body.","options":["Socrates","Dewey","Aristotle (384-322)"]},
    {"key":"poe-learn-04","pool":"learning","lesson":3,"difficulty":"beginner","correct":"A","prompt":"Who defined education as the harmonious development of the physical, mental and spiritual powers?","explanation":"Ellen G. White (1824-1915) defined education as the harmonious development of the physical, mental and spiritual powers.","options":["Ellen G. White (1824-1915)","Dayananda, Swami (1824-1883)","Gandhi, M.K. (1869-1948)"]},
    {"key":"poe-learn-14","pool":"learning","lesson":3,"difficulty":"beginner","correct":"B","prompt":"Who defined education as the kindling of a flame, not the filling of a vessel?","explanation":"Socrates defined education as the kindling of a flame, not the filling of a vessel.","options":["Plato","Socrates","Aristotle (384-322)"]},
    {"key":"poe-learn-16","pool":"learning","lesson":3,"difficulty":"beginner","correct":"C","prompt":"Who defines education as midwifery for the soul?","explanation":"Socrates defines education as midwifery for the soul.","options":["Dewey","Aristotle (384-322)","Socrates"]},
    {"key":"poe-learn-20","pool":"learning","lesson":3,"difficulty":"beginner","correct":"B","prompt":"According to whom is education not a preparation for life, but life itself?","explanation":"Dewey said that education is not a preparation for life; it is life itself.","options":["Immanuel Kant","Dewey","Socrates"]},
    {"key":"poe-learn-21","pool":"learning","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Which kind of education is based on socialisation?","explanation":"Informal education is based on socialisation.","options":["Formal education","Informal education","Non-formal education"]},
    {"key":"poe-learn-22","pool":"learning","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Education is the most effective tool for which of these?","explanation":"Education is the most effective tool for social transformation.","options":["The love of wisdom","Social transformation","The pursuit of wisdom"]},
    {"key":"poe-learn-23","pool":"learning","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Philosophy is often referred to as which of these?","explanation":"Philosophy is often referred to as the love of wisdom.","options":["The pursuit of wisdom","The love of wisdom","Logic, a branch of philosophy"]},
    {"key":"poe-learn-24","pool":"learning","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Philosophy originates from which two Greek words?","explanation":"Philosophy originates from the Greek words philos and sophos.","options":["Educare and educere","Philos and sophos","Cognitive and affective"]},
    {"key":"poe-learn-25","pool":"learning","lesson":4,"difficulty":"beginner","correct":"B","prompt":"Which source defines philosophy as the pursuit of wisdom?","explanation":"Merriam-Webster Dictionary defines philosophy as the pursuit of wisdom.","options":["UNESCO, as cited by Umar (2014)","Merriam-Webster Dictionary","Benjamin Bloom (1956)"]},
    {"key":"poe-learn-26","pool":"learning","lesson":4,"difficulty":"intermediate","correct":"A","prompt":"According to Immanuel Kant, the task of philosophy is united by which four questions?","explanation":"Kant's four questions are: What can I know; What should I do; What may I hope for; What is a human being.","options":["What can I know; What should I do; What may I hope for; What is a human being","Philos and sophos","Knowledge, comprehension, application, analysis, synthesis and evaluation"]},
    {"key":"poe-learn-27","pool":"learning","lesson":4,"difficulty":"beginner","correct":"B","prompt":"All human beings by nature stretch themselves out toward which of these?","explanation":"All human beings by nature stretch themselves out toward knowing.","options":["The love of wisdom","Knowing","Logic"]},
    {"key":"poe-learn-28","pool":"learning","lesson":4,"difficulty":"beginner","correct":"A","prompt":"Which branch of philosophy is concerned with the principles of reasoning and valid argumentation?","explanation":"Logic, a branch of philosophy, is concerned with the principles of reasoning and valid argumentation.","options":["Logic","The love of wisdom","The pursuit of wisdom"]},
    {"key":"poe-learn-65","pool":"learning","lesson":5,"difficulty":"intermediate","correct":"C","prompt":"How many categories are under the cognitive domain, and what are they?","explanation":"There are six categories under the cognitive domain: knowledge, comprehension, application, analysis, synthesis and evaluation.","options":["Three: cognitive, affective and psychomotor","Five: receiving, responding, valuing, organisation and characterisation","Six: knowledge, comprehension, application, analysis, synthesis and evaluation"]},
    {"key":"poe-learn-66","pool":"learning","lesson":5,"difficulty":"beginner","correct":"A","prompt":"Which cognitive category is the ability to recall data and information?","explanation":"Knowledge is the ability to recall data and information.","options":["Knowledge","Comprehension","Application"]},
    {"key":"poe-learn-67","pool":"learning","lesson":5,"difficulty":"beginner","correct":"B","prompt":"Which cognitive category is understanding the meaning of what is known?","explanation":"Comprehension is understanding the meaning of what is known.","options":["Knowledge","Comprehension","Analysis"]},
    {"key":"poe-learn-68","pool":"learning","lesson":5,"difficulty":"beginner","correct":"A","prompt":"Which cognitive category is the ability to utilise an abstraction or to use knowledge in a new situation?","explanation":"Application is the ability to utilise an abstraction or to use knowledge in a new situation.","options":["Application","Analysis","Synthesis"]},
    {"key":"poe-learn-69","pool":"learning","lesson":5,"difficulty":"beginner","correct":"A","prompt":"Which cognitive category is the ability to differentiate facts and opinions?","explanation":"Analysis is the ability to differentiate facts and opinions.","options":["Analysis","Evaluation","Knowledge"]},
    {"key":"poe-learn-70","pool":"learning","lesson":5,"difficulty":"intermediate","correct":"A","prompt":"Which cognitive category integrates elements to form a structure and establish a new meaning?","explanation":"Synthesis integrates elements to form a sound pattern or structure to establish a new meaning.","options":["Synthesis","Application","Comprehension"]},
    {"key":"poe-learn-71","pool":"learning","lesson":5,"difficulty":"intermediate","correct":"A","prompt":"Which cognitive category is the ability to come up with judgements about the importance of concepts?","explanation":"Evaluation is the ability to come up with judgements about the importance of concepts.","options":["Evaluation","Analysis","Synthesis"]},
    {"key":"poe-learn-72","pool":"learning","lesson":5,"difficulty":"beginner","correct":"B","prompt":"The affective domain involves which of these?","explanation":"The affective domain involves feelings, emotions and attitude.","options":["Knowledge, values and ability","Feelings, emotions and attitude","Head, heart and hand"]},
    {"key":"poe-learn-73","pool":"learning","lesson":5,"difficulty":"intermediate","correct":"B","prompt":"The affective domain is categorised into which sub-domains?","explanation":"The affective domain has five sub-domains: receiving, responding, valuing, organisation and characterisation.","options":["Three: cognitive, affective and psychomotor","Five: receiving, responding, valuing, organisation and characterisation","Six: perception, set, guided response, mechanism, adaptation and origination"]},
    {"key":"poe-learn-74","pool":"learning","lesson":5,"difficulty":"intermediate","correct":"C","prompt":"The psychomotor domain was thoroughly described in which period?","explanation":"The psychomotor domain was thoroughly described in the 1970s. The key dates the cognitive domain to 1956 and the affective domain to 1964.","options":["1956","1964","The 1970s"]},
    {"key":"poe-learn-75","pool":"learning","lesson":5,"difficulty":"intermediate","correct":"B","prompt":"Which categories are under the psychomotor domain?","explanation":"There are six psychomotor categories: perception, set, guided response, mechanism, adaptation and origination.","options":["Five: receiving, responding, valuing, organisation and characterisation","Six: perception, set, guided response, mechanism, adaptation and origination","Six: knowledge, comprehension, application, analysis, synthesis and evaluation"]},
    {"key":"poe-learn-76","pool":"learning","lesson":6,"difficulty":"beginner","correct":"A","prompt":"Which field of psychology is concerned with individual behaviour?","explanation":"Behaviourist theory of learning is a field of psychology concerned with individual behaviour.","options":["Behaviourist theory of learning","Bloom's taxonomy","Informal education"]},
    {"key":"poe-learn-77","pool":"learning","lesson":6,"difficulty":"intermediate","correct":"B","prompt":"According to whom is learning an enduring change of behaviour resulting from external events?","explanation":"According to Skinner (1953, 1968), learning is an enduring change of behaviour resulting from external events.","options":["Benjamin Bloom (1956)","Skinner (1953, 1968)","James Hartley"]},
    {"key":"poe-learn-78","pool":"learning","lesson":6,"difficulty":"beginner","correct":"B","prompt":"How many critical assumptions underpin the behaviourist view of learning?","explanation":"Three critical assumptions underpin the behaviourist view of learning. The key states the number and does not list the assumptions.","options":["Two","Three","Four"]},
    {"key":"poe-learn-79","pool":"learning","lesson":6,"difficulty":"beginner","correct":"A","prompt":"What are the two basic views in behaviourism?","explanation":"The two basic views in behaviourism are classical conditioning and operant conditioning.","options":["Classical conditioning and operant conditioning","Cognitive and affective","Formal and informal"]},
    {"key":"poe-learn-80","pool":"learning","lesson":6,"difficulty":"intermediate","correct":"B","prompt":"Who presents four fundamental principles of the behaviourist model of learning?","explanation":"James Hartley presents four fundamental principles of the behaviourist model of learning. The key does not list the four principles.","options":["Skinner (1953, 1968)","James Hartley","Benjamin Bloom (1956)"]},
    {"key":"poe-battle-01","pool":"battle","lesson":3,"difficulty":"beginner","correct":"A","prompt":"Who defined education as the formation of character?","explanation":"Dayananda, Swami (1824-1883) defined education as the formation of character.","options":["Dayananda, Swami (1824-1883)","Gandhi, M.K. (1869-1948)","Aristotle (384-322)","Ellen G. White (1824-1915)"]},
    {"key":"poe-battle-02","pool":"battle","lesson":3,"difficulty":"beginner","correct":"B","prompt":"Who defined education as the all-round drawing out of the best?","explanation":"Gandhi, M.K. (1869-1948) defined education as the all-round drawing out of the best.","options":["Dayananda, Swami (1824-1883)","Gandhi, M.K. (1869-1948)","Aristotle (384-322)","Socrates"]},
    {"key":"poe-battle-03","pool":"battle","lesson":3,"difficulty":"beginner","correct":"C","prompt":"Who defined education as the creation of a sound mind in a sound body?","explanation":"Aristotle (384-322) defined education as the creation of a sound mind in a sound body.","options":["Gandhi, M.K. (1869-1948)","Dewey","Aristotle (384-322)","Socrates"]},
    {"key":"poe-battle-04","pool":"battle","lesson":3,"difficulty":"beginner","correct":"D","prompt":"Who defined education as the harmonious development of the physical, mental and spiritual powers?","explanation":"Ellen G. White (1824-1915) defined education as the harmonious development of the physical, mental and spiritual powers.","options":["Dayananda, Swami (1824-1883)","Gandhi, M.K. (1869-1948)","Aristotle (384-322)","Ellen G. White (1824-1915)"]},
    {"key":"poe-battle-05","pool":"battle","lesson":3,"difficulty":"beginner","correct":"B","prompt":"Who defined education as the kindling of a flame, not the filling of a vessel?","explanation":"Socrates defined education as the kindling of a flame, not the filling of a vessel.","options":["Plato","Socrates","Aristotle (384-322)","Dewey"]},
    {"key":"poe-battle-06","pool":"battle","lesson":3,"difficulty":"intermediate","correct":"C","prompt":"Who said that education is not a preparation for life, but life itself?","explanation":"Dewey said that education is not a preparation for life; it is life itself.","options":["Socrates","Aristotle (384-322)","Dewey","Immanuel Kant"]},
    {"key":"poe-battle-07","pool":"battle","lesson":3,"difficulty":"beginner","correct":"C","prompt":"Who defines education as midwifery for the soul?","explanation":"Socrates defines education as midwifery for the soul.","options":["Plato","Aristotle (384-322)","Socrates","Dewey"]}
  ]$questions$;
begin
  select id into v_course from public.courses where code = 'AUE-GST 201';
  if v_course is null or (select count(*) from public.courses where code = 'AUE-GST 201') <> 1 then
    raise exception 'AUE-GST 201 must be exactly one shared course';
  end if;
  if exists (select 1 from public.questions where course_id = v_course and logical_key = 'poe-learn-05')
     and exists (select 1 from public.questions where course_id = v_course and logical_key = 'poe-battle-07') then
    return;
  end if;
  if exists (select 1 from public.questions where course_id = v_course and logical_key like 'poe-%') then
    raise exception 'Incomplete Philosophy of Education import found; refusing to add a second copy';
  end if;

  select ur.user_id into v_reviewer
  from public.user_roles ur
  where ur.role = 'admin'
  order by ur.granted_at
  limit 1;
  if v_reviewer is null then
    select p.id into v_reviewer from public.profiles p order by p.created_at limit 1;
  end if;
  v_publish := v_reviewer is not null;
  if v_publish then
    perform set_config('scholau.allow_publish', 'on', true);
  end if;

  insert into public.modules (course_id, title, position)
  values (v_course, 'Philosophy of Education', 1)
  returning id into v_module;

  for v_row in select value from jsonb_array_elements(v_lessons) loop
    v_errors := private.validate_lesson_blocks(v_row -> 'blocks');
    if cardinality(v_errors) > 0 then
      raise exception 'lesson % failed block validation: %', v_row ->> 'title', array_to_string(v_errors, '; ');
    end if;
    insert into public.lessons (course_id, module_id, position)
    values (v_course, v_module, (v_row ->> 'position')::integer)
    returning id into v_lesson;
    v_lesson_ids[(v_row ->> 'position')::integer] := v_lesson;
    insert into public.lesson_versions (
      lesson_id, version, title, objective, blocks, estimated_minutes, source_reference, status, reviewed_by, published_at
    ) values (
      v_lesson, 1, v_row ->> 'title', v_row ->> 'objective', v_row -> 'blocks', (v_row ->> 'minutes')::integer, v_source,
      case when v_publish then 'published' else 'draft' end,
      case when v_publish then v_reviewer else null end,
      case when v_publish then now() else null end
    );
  end loop;

  create temp table poe_imported (
    lesson_position integer not null,
    pool text not null,
    logical_key text not null,
    question_version_id uuid not null
  ) on commit drop;

  for v_row in select value from jsonb_array_elements(v_questions) loop
    v_pool := v_row ->> 'pool';
    v_lesson_pos := (v_row ->> 'lesson')::integer;
    if v_pool = 'battle' and jsonb_array_length(v_row -> 'options') <> 4 then
      raise exception 'battle question % needs exactly four real options', v_row ->> 'key';
    end if;
    if v_pool = 'learning' and jsonb_array_length(v_row -> 'options') <> 3 then
      raise exception 'learning question % must keep the three-option shape', v_row ->> 'key';
    end if;
    if coalesce(length(btrim(v_row ->> 'prompt')), 0) not between 1 and 2000
       or coalesce(length(btrim(v_row ->> 'explanation')), 0) not between 1 and 4000 then
      raise exception 'question % has an empty prompt or explanation', v_row ->> 'key';
    end if;
    insert into public.questions (course_id, lesson_id, pool, logical_key)
    values (v_course, v_lesson_ids[v_lesson_pos], v_pool, v_row ->> 'key')
    returning id into v_question;
    insert into public.question_versions (
      question_id, version, prompt, difficulty, usage, source_reference, status, reviewed_by, published_at, answer_format
    ) values (
      v_question,
      1,
      btrim(v_row ->> 'prompt'),
      v_row ->> 'difficulty',
      case when v_pool = 'battle' then array['battle']::text[] else array['review', 'practice']::text[] end,
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
      if coalesce(length(v_body), 0) not between 1 and 1000 then
        raise exception 'question % has an empty option', v_row ->> 'key';
      end if;
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
    if v_publish then
      update public.question_versions
         set status = 'published', reviewed_by = v_reviewer, published_at = now()
       where id = v_version;
    end if;
    insert into poe_imported (lesson_position, pool, logical_key, question_version_id)
    values (v_lesson_pos, v_pool, v_row ->> 'key', v_version);
  end loop;

  if (select count(*) from poe_imported where pool = 'learning') <> 44
     or (select count(*) from poe_imported where pool = 'battle') <> 7 then
    raise exception 'Philosophy of Education question counts did not match the keyed set';
  end if;

  for v_lesson_pos in 1..6 loop
    select count(*) into v_count from poe_imported where pool = 'learning' and lesson_position = v_lesson_pos;
    if v_count < 1 then
      raise exception 'lesson % has no learning questions', v_lesson_pos;
    end if;
    insert into public.assessments (course_id, lesson_id, kind, title, position)
    values (
      v_course,
      v_lesson_ids[v_lesson_pos],
      'review',
      (select lv.title || ' review' from public.lesson_versions lv where lv.lesson_id = v_lesson_ids[v_lesson_pos] and lv.version = 1),
      1
    ) returning id into v_assessment;
    insert into public.assessment_versions (
      assessment_id, version, question_count, duration_seconds, feedback_mode, status, reviewed_by, published_at
    ) values (
      v_assessment, 1, v_count, null, 'immediate', 'draft', null, null
    ) returning id into v_assessment_version;
    insert into public.assessment_questions (assessment_version_id, question_version_id, position)
    select v_assessment_version, q.question_version_id, row_number() over (order by q.logical_key)::integer
    from poe_imported q
    where q.pool = 'learning' and q.lesson_position = v_lesson_pos;
    if v_publish then
      update public.assessment_versions
         set status = 'published', reviewed_by = v_reviewer, published_at = now()
       where id = v_assessment_version;
    end if;
  end loop;

  select count(*) into v_count from poe_imported where pool = 'learning';
  insert into public.assessments (course_id, lesson_id, kind, title, position)
  values (v_course, null, 'practice', 'Philosophy of Education practice', 1)
  returning id into v_assessment;
  insert into public.assessment_versions (
    assessment_id, version, question_count, duration_seconds, feedback_mode, status, reviewed_by, published_at
  ) values (
    v_assessment, 1, v_count, null, 'after_submit', 'draft', null, null
  ) returning id into v_assessment_version;
  insert into public.assessment_questions (assessment_version_id, question_version_id, position)
  select v_assessment_version, q.question_version_id, row_number() over (order by q.logical_key)::integer
  from poe_imported q
  where q.pool = 'learning';
  if v_publish then
    update public.assessment_versions
       set status = 'published', reviewed_by = v_reviewer, published_at = now()
     where id = v_assessment_version;
    perform set_config('scholau.allow_publish', 'off', true);
  end if;
end
$migration$;
