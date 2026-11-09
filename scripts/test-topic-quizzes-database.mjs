import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";

export async function createTopicQuizTestDatabase() {
  const fixture = await createChallengeTestDatabase();
  const { db, id, query, offering, otherOffering, admin } = fixture;
  await db.exec(readFileSync("supabase/migrations/20261022000100_per_answer_xp.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261106203528_compact_topic_assessments.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261109201000_assessment_reward_boost.sql", "utf8"));
  const course = (await query("select course_id from public.course_offerings where id=$1", [offering]))[0].course_id;
  const otherCourse = (await query("select course_id from public.course_offerings where id=$1", [otherOffering]))[0].course_id;
  const topics = [id(801), id(802), id(803), id(804), id(805)];
  const module = id(800), otherModule = id(806);
  await db.exec("set session_replication_role=replica");
  await db.query("insert into public.modules(id,course_id,title,position) values($1,$2,'Quiz topics',99),($3,$4,'Other course',99)", [module, course, otherModule, otherCourse]);
  for (const [i, lesson] of topics.entries()) {
    await db.query("insert into public.lessons(id,course_id,module_id,position) values($1,$2,$3,$4)", [lesson, i === 4 ? otherCourse : course, i === 4 ? otherModule : module, i + 1]);
    await db.query("insert into public.lesson_versions(lesson_id,version,title,objective,blocks,estimated_minutes,status,source_reference,reviewed_by,published_at) values($1,1,$2,'Learn this topic','[]',5,$3,'test',$4,now())", [lesson, ['Cells', 'Genetics', 'Coming soon', 'Draft topic', 'Foreign topic'][i], i === 3 ? 'draft' : 'published', admin]);
  }
  let serial = 900;
  const questions = [];
  for (const [topicIndex, lesson] of topics.entries()) {
    if (topicIndex === 2) continue;
    for (let i = 0; i < 4; i++) {
      const q = id(serial++), qv = id(serial++), correct = id(serial++);
      await db.query("insert into public.questions(id,course_id,lesson_id,pool,logical_key) values($1,$2,$3,'learning',$4)", [q, topicIndex === 4 ? otherCourse : course, lesson, `topic-test-${q}`]);
      await db.query("insert into public.question_versions(id,question_id,version,prompt,difficulty,usage,status,source_reference,reviewed_by,published_at) values($1,$2,1,$3,$4,array['practice'],'published','test',$5,now())", [qv,q,`Question ${topicIndex}-${i}`,i === 3 ? 'advanced' : 'beginner',admin]);
      for (let option = 0; option < 4; option++) await db.query("insert into public.question_options(id,question_version_id,label,body,position) values($1,$2,$3,$4,$5)", [option === 0 ? correct : id(serial++),qv,String(option),String(option + 1),option + 1]);
      await db.query("insert into private.question_answer_keys values($1,$2,'The first option is correct.')", [qv,correct]);
      questions.push({ qv, lesson, correct });
    }
  }
  await db.exec("set session_replication_role=origin");
  return { ...fixture, topics, questions };
}

if (process.argv[1]?.endsWith("test-topic-quizzes-database.mjs")) {
  const { db, id, query, login, offering, otherOffering, students, topics } = await createTopicQuizTestDatabase();
  let checks = 0;
  const eq = (a,b) => { assert.deepEqual(a,b); checks++; };
  const fails = async (fn,pattern) => { await assert.rejects(fn,pattern); checks++; };
  const rpc = async (name,args=[]) => (await query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as value`,args))[0].value;
  const begin = (lessons=[topics[0],topics[1]],count=4,key=id(2000)) => rpc('start_topic_quiz_v1',[offering,lessons,count,key]);
  try {
    await login(students[3]);
    await fails(()=>rpc('get_topic_quiz_options_v1',[offering]),/NOT_ENROLLED|FORBIDDEN/);
    await fails(()=>begin(),/NOT_ENROLLED|FORBIDDEN/);
    await login(students[0]);
    const options = await rpc('get_topic_quiz_options_v1',[offering]);
    eq(options.topics.length,3); eq(options.topics.map(t=>t.question_count),[3,3,0]);
    eq(options.active_attempt_id,null);
    for (const selected of [[],[topics[0],topics[0]],[topics[2]],[topics[3]],[topics[4]],[null]]) {
      await fails(()=>begin(selected,4),/VALIDATION_FAILED|CONTENT_UNAVAILABLE/);
    }
    for (const count of [0,1,7,101,null]) await fails(()=>begin(undefined,count),/VALIDATION_FAILED/);
    const attempt=await begin();
    eq(attempt.kind,'practice');eq(attempt.feedback_mode,'after_submit');eq(attempt.total_count,4);eq(attempt.expires_at,null);
    eq(attempt.questions.length,4);eq(new Set(attempt.questions.map(q=>q.question_version_id)).size,4);
    eq(attempt.questions.every(q=>q.feedback===null),true);
    eq((await begin()).attempt_id,attempt.attempt_id);
    await fails(()=>begin([topics[1]],2,id(2001)),/ATTEMPT_ACTIVE/);
    eq((await rpc('get_topic_quiz_options_v1',[offering])).active_attempt_id,attempt.attempt_id);
    await db.exec('reset role');
    eq((await query('select count(distinct q.lesson_id)::int n from public.attempt_questions aq join public.question_versions qv on qv.id=aq.question_version_id join public.questions q on q.id=qv.question_id where aq.attempt_id=$1',[attempt.attempt_id]))[0].n,2);
    eq((await query("select count(*)::int n from public.attempt_questions aq join public.question_versions qv on qv.id=aq.question_version_id where aq.attempt_id=$1 and qv.difficulty='advanced'",[attempt.attempt_id]))[0].n,0);
    eq((await query("select has_function_privilege('anon','public.start_topic_quiz_v1(uuid,uuid[],integer,uuid)','execute') value"))[0].value,false);
    await login(students[1]);
    eq((await rpc('get_topic_quiz_options_v1',[offering])).active_attempt_id,null);
    await fails(()=>query('select * from private.topic_quiz_banks'),/permission denied/);
    const another=await begin(undefined,2,id(2002));eq(another.attempt_id!==attempt.attempt_id,true);
    await login(students[0]);
    await db.exec('reset role');
    const keys = await query('select aq.question_version_id, k.correct_option_id from public.attempt_questions aq join private.question_answer_keys k using (question_version_id) where aq.attempt_id=$1', [attempt.attempt_id]);
    const answers = keys.map(key=>({question_version_id:key.question_version_id,option_id:key.correct_option_id,answer_revision:1}));
    await login(students[0]);
    await rpc('save_attempt_answers_v1',[attempt.attempt_id,answers,id(2003)]);
    const submitted=await rpc('submit_attempt_v1',[attempt.attempt_id,null,id(2004)]);
    eq(submitted.status,'submitted');eq(submitted.questions.every(q=>q.feedback!==null),true);
    eq(submitted.result.xp_awarded,13);
    eq((await rpc('get_xp_progress_v1')).badges.map(badge=>badge.code).sort(),['first_quiz','perfect_practice','quiz_ace']);
    eq((await rpc('get_topic_quiz_options_v1',[offering])).active_attempt_id,null);
    eq((await begin([topics[1]],2,id(2005))).total_count,2);
    await fails(()=>rpc('get_topic_quiz_options_v1',[otherOffering]),/NOT_ENROLLED|FORBIDDEN/);
    console.log(`Topic quiz database: ${checks} checks passed.`);
  } finally { await db.close(); }
}
