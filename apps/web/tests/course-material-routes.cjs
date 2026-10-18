/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS regression harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    { exports, require: name => name in dependencies ? dependencies[name] : require(name), Response, Buffer, URL, encodeURIComponent, Promise, Error, SyntaxError });
  return exports;
}
const schema = compile('lib/course-material-schema.ts', {});
class NextResponse extends Response { static json(data, options) { return new NextResponse(JSON.stringify(data), options); } }
const sha = 'a'.repeat(64);
const bundle = {course_code:'COS 101',materials:[{sha256:sha,object_key:`course-materials/${sha}.pdf`,filename:'Computing.pdf',bytes:10}],lessons:[{}],questions:[{}]};
(async()=>{
  let user = true, role = true, storage = true, missing = false, valid = true;
  let calls = [], reads = 0, signed = 0;
  const client = { auth:{getUser:async()=>({data:{user:user?{id:'user'}:null},error:null})}, rpc:async(name,args)=>{
    calls.push([name,args]);
    if(name==='admin_sync_course_materials_v1') return role ? {data:{valid,published:args.p_publish},error:null} : {error:{message:'FORBIDDEN'}};
    if(name==='get_course_materials_v1') return {data:{items:[{id:sha,filename:'Computing.pdf',bytes:10}]},error:null};
    return role ? {data:{object_key:`course-materials/${sha}.pdf`,filename:'Computing.pdf'},error:null} : {error:{message:'NOT_ENROLLED'}};
  }};
  const dependencies = {
    'next/server': {NextResponse}, '@/lib/supabase/request':{allowRequestWrite:request=>request.headers.get('origin')==='https://school.example',getRequestSupabase:async()=>client},
    '@/lib/r2-storage':{getR2Storage:()=>({bucket:'private',client:{send:async()=>{reads++;if(missing)throw Error('Not found');return {ContentLength:10,Metadata:{sha256:storage?sha:'b'.repeat(64)}};}}})},
    '@aws-sdk/client-s3':{HeadObjectCommand:class {},GetObjectCommand:class {constructor(value){this.input=value;}}},
    '@aws-sdk/s3-request-presigner':{getSignedUrl:async()=>{signed++;return 'https://files.example/signed';}},
    '@/lib/profile-photo-server':{readPhotoBody:async request=>Buffer.from(await request.arrayBuffer())},
    '@/lib/course-material-schema':schema,
    '@/lib/lesson-asset-path':{UUID_PATTERN:/^[a-f0-9-]{36}$/},
  };
  const admin = compile('app/api/admin/content-sync/route.ts',dependencies);
  function post(value, origin='https://school.example') { return new Request('https://school.example/api/admin/content-sync',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)}); }
  const payload = {bundle,dryRun:false,publish:true};
  assert.equal((await admin.POST(post(payload,'https://evil.example'))).status,403);
  user=false; assert.equal((await admin.POST(post(payload))).status,401); user=true;
  role=false; assert.equal((await admin.POST(post(payload))).status,403); assert.equal(reads,0); role=true;
  storage=false; calls=[];
  assert.equal((await admin.POST(post(payload))).status,503);
  assert.equal(calls.length,1); assert.equal(calls[0][1].p_dry_run,true);
  storage=true;missing=true;
  assert.equal((await admin.POST(post(payload))).status,503);missing=false;
  valid=false;assert.equal((await admin.POST(post(payload))).status,422);valid=true;
  calls=[]; assert.equal((await admin.POST(post({...payload,dryRun:true}))).status,200);assert.equal(calls.length,1);
  calls=[]; assert.equal((await admin.POST(post(payload))).status,200);assert.equal(calls.length,2);assert.equal(calls[1][1].p_dry_run,false);
  assert.equal((await admin.POST(post({...payload,bundle:{...bundle,materials:[{...bundle.materials[0],object_key:'../review/evidence.json'}]}}))).status,400);
  const materialRoute = compile('app/api/course-materials/route.ts',dependencies);
  function get(query) { const request = new Request('https://school.example/api/course-materials?'+query);request.nextUrl=new URL(request.url);return request; }
  const offering = '10000000-0000-4000-8000-000000000001';
  assert.equal((await materialRoute.GET(get('offeringId=bad'))).status,400);
  user=false;assert.equal((await materialRoute.GET(get('offeringId='+offering))).status,401);user=true;
  const list = await materialRoute.GET(get('offeringId='+offering));assert.equal(list.status,200);assert.equal((await list.json()).items.length,1);
  role=false;assert.equal((await materialRoute.GET(get(`offeringId=${offering}&material=${sha}`))).status,403);assert.equal(signed,0);role=true;
  const download = await materialRoute.GET(get(`offeringId=${offering}&material=${sha}`));assert.equal(download.status,303);assert.equal(signed,1);assert.equal(download.headers.get('cache-control'),'private, no-store');
  console.log('Passed API checks: origin, authentication, administrator gate, missing/corrupt R2 object, dry run, publication, invalid path, enrollment authorization, list, and private signed download.');
})().catch(error=>{console.error(error);process.exitCode=1;});
