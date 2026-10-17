begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.r2_user() returns uuid language plpgsql as $$ declare id uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,raw_user_meta_data,created_at) values(id,id::text||'@r2.test','{"display_name":"R2 Test"}',now()); return id;
end $$;
create function pg_temp.r2_login(id uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub',coalesce(id::text,''),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true);
end $$;
select set_config('r2.student',pg_temp.r2_user()::text,true);
select set_config('r2.outsider',pg_temp.r2_user()::text,true);
select set_config('r2.admin','90000000-0000-4000-8000-000000000002',true);
select set_config('r2.path','20000000-0000-4000-8000-000000000001/22000000-0000-4000-8000-000000000001/test.webp',true);
select private.apply_academic_profile(current_setting('r2.student')::uuid,current_setting('r2.student')::uuid,
 '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
 '10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000006','initial',null,null);
insert into public.lesson_versions(id,lesson_id,version,title,objective,blocks,estimated_minutes,source_reference)
values('23000000-0000-4000-8000-000000000099','22000000-0000-4000-8000-000000000001',99,'R2 fixture','Verify access to published lesson images',
 jsonb_build_array(jsonb_build_object('type','image','path',current_setting('r2.path'),'alt','Access test')),5,'R2 test fixture');

select pg_temp.r2_login(current_setting('r2.student')::uuid);
set local role authenticated;
select is(public.can_read_lesson_asset_v1(current_setting('r2.path')),false,'draft image is not readable by a student');
select is(public.lesson_asset_upload_course_v1('22000000-0000-4000-8000-000000000001'),null::uuid,'student cannot upload');
select is(public.can_read_lesson_asset_v1('invalid'),false,'malformed object path is denied');
reset role;
select private.publish_lesson_version('23000000-0000-4000-8000-000000000099',current_setting('r2.admin')::uuid);
set local role authenticated;
select is(public.can_read_lesson_asset_v1(current_setting('r2.path')),true,'enrolled student can read a referenced published image');
select is(public.can_read_lesson_asset_v1(replace(current_setting('r2.path'),'test.webp','other.webp')),false,'unreferenced path is denied');
reset role;
select pg_temp.r2_login(current_setting('r2.outsider')::uuid);
set local role authenticated;
select is(public.can_read_lesson_asset_v1(current_setting('r2.path')),false,'non-enrolled user is denied');
reset role;
select pg_temp.r2_login(current_setting('r2.admin')::uuid);
set local role authenticated;
select is(public.can_read_lesson_asset_v1(current_setting('r2.path')),true,'active administrator can preview');
select is(public.lesson_asset_upload_course_v1('22000000-0000-4000-8000-000000000001'),'20000000-0000-4000-8000-000000000001'::uuid,'administrator gets the actual course for upload');
select is(public.lesson_asset_upload_course_v1('00000000-0000-4000-8000-000000000000'),null::uuid,'nonexistent lesson cannot receive uploads');
reset role;
update public.profiles set deactivated_at=now() where id=current_setting('r2.admin')::uuid;
set local role authenticated;
select is(public.can_read_lesson_asset_v1(current_setting('r2.path')),false,'frozen administrator is denied reads');
select is(public.lesson_asset_upload_course_v1('22000000-0000-4000-8000-000000000001'),null::uuid,'frozen administrator cannot upload');
reset role;
select pg_temp.r2_login(current_setting('r2.student')::uuid);
update public.enrollments set ended_at=now() where user_id=current_setting('r2.student')::uuid;
set local role authenticated;
select is(public.can_read_lesson_asset_v1(current_setting('r2.path')),false,'ended enrollment denies new signed URLs');
reset role;
set local role anon;
select throws_ok('select public.can_read_lesson_asset_v1(''invalid'')','42501',null,'guest cannot call read authorization');
select throws_ok('select public.lesson_asset_upload_course_v1(''22000000-0000-4000-8000-000000000001'')','42501',null,'guest cannot call upload authorization');
reset role;
select * from finish();
rollback;
