import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChallengeTestDatabase } from './lib/course-challenge-test-db.mjs';
const {db,lecturer,offering,query}=await createChallengeTestDatabase();
const sql=readFileSync('supabase/migrations/20261029001600_restore_approved_lecturer_courses.sql','utf8');
const apply=()=>db.exec('begin;'+sql+'commit;');let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await db.exec('reset role');
 await db.query('delete from public.lecturer_course_assignments where user_id=$1',[lecturer.uid]);
 const before=(await query('select revision from public.lecturer_applications where id=$1',[lecturer.app]))[0].revision;
 await apply();
 eq((await query('select count(*)::int n from public.lecturer_course_assignments where user_id=$1',[lecturer.uid]))[0].n,2);
 eq((await query('select revision from public.lecturer_applications where id=$1',[lecturer.app]))[0].revision,before+1);
 eq((await query("select count(*)::int n from private.lecturer_application_reviews where application_id=$1 and action='courses_assigned' and actor_id is null",[lecturer.app]))[0].n,1);
 eq((await query("select count(*)::int n from public.notifications where event_key=$1",['legacy-lecturer-courses:'+lecturer.app]))[0].n,1);
 await apply();eq((await query('select revision from public.lecturer_applications where id=$1',[lecturer.app]))[0].revision,before+1);
 await db.query('delete from public.lecturer_course_assignments where user_id=$1',[lecturer.uid]);
 await apply();eq((await query('select count(*)::int n from public.lecturer_course_assignments where user_id=$1',[lecturer.uid]))[0].n,0);
 await db.query("delete from private.lecturer_application_reviews where application_id=$1 and action='courses_assigned'",[lecturer.app]);
 await db.query("update public.lecturer_applications set status='pending' where id=$1",[lecturer.app]);
 await apply();eq((await query('select count(*)::int n from public.lecturer_course_assignments where user_id=$1',[lecturer.uid]))[0].n,0);
 await db.query("update public.lecturer_applications set status='approved' where id=$1",[lecturer.app]);
 await db.query('insert into public.lecturer_course_assignments(user_id,offering_id) values($1,$2)',[lecturer.uid,offering]);
 await apply();eq((await query('select count(*)::int n from public.lecturer_course_assignments where user_id=$1',[lecturer.uid]))[0].n,1);
 console.log(JSON.stringify({checks}));
}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.close();}
