import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const runtime = createRequire(resolve(process.env.LEGAL_TEST_RUNTIME ?? '../.legal-test-runtime','package.json'));
const { chromium } = runtime('playwright');
const origin = process.env.LEGAL_TEST_ORIGIN ?? 'http://127.0.0.1:3138';
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultNavigationTimeout(60000);
let unavailable=false; let signups=[]; let legalReads=0; let checks=0;
const version='2026-10-19-draft-1';
await context.route('http://127.0.0.1:54321/**', async route => {
  const url=new URL(route.request().url());
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
  if(route.request().method()==='OPTIONS') return route.fulfill({status:200,headers});
  let body={}; let status=200;
  if(url.pathname.endsWith('/get_registration_legal_status_v1')) { legalReads++;body={terms_version:version,privacy_version:version,guardian_enabled:false,support_email:null}; if(unavailable) { status=503;body={message:'Not installed'}; } }
  else if(url.pathname.endsWith('/is_username_available_v1')) body=true;
  else if(url.pathname.includes('/app_config')) body={feature_flags:{lecturer_applications:true}};
  else if(url.pathname.endsWith('/signup')) { signups.push(route.request().postDataJSON());body={id:'80000000-0000-4000-8000-000000000001',aud:'authenticated',email:'legal-browser@example.test',identities:[]}; }
  return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
});
await mkdir('.legal-verification',{recursive:true});
try {
  for(const path of ['/privacy','/terms']) {
    for(const width of [365,1440]) {
      await page.setViewportSize({width,height:900});
      const response=await page.goto(origin+path,{waitUntil:'networkidle'});
      assert.equal(response.status(),200); assert.equal(new URL(page.url()).pathname,path);checks+=2;
      await page.getByRole('heading',{level:1,name:path==='/privacy'?'Privacy Policy':'Terms of Use',exact:true}).waitFor();
      assert.match(await page.title(),/Draft/);checks++;
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);checks++;
      assert.match(await page.locator('meta[name=viewport]').getAttribute('content'),/user-scalable=yes/);checks++;
      await page.getByRole('navigation',{name:/sections/}).getByRole('link').first().click();
      assert.match(page.url(),/#/);checks++;
      await page.screenshot({path:`.legal-verification/${path.slice(1)}-${width}.png`,fullPage:true});
    }
  }
  await page.goto(origin+'/privacy');
  await page.emulateMedia({media:'print'});
  await page.pdf({path:'.legal-verification/privacy-print.pdf',format:'A4',printBackground:true});
  assert.equal(await page.locator('.legal-contents').isVisible(),false); checks++;
  await page.emulateMedia({media:'screen'});
  await page.goto(origin+'/terms');
  await page.pdf({path:'.legal-verification/terms-print.pdf',format:'A4',printBackground:true});
  for(const role of ['student','lecturer']) {
    await page.goto(origin+`/sign-up?role=${role}`,{waitUntil:'networkidle'});
    await page.getByText('Checking registration availability…').waitFor({state:'hidden'});
    await page.getByLabel('I am under 18',{exact:true}).check();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'not open yet'}).waitFor();
    assert.equal(signups.length,role==='student'?0:1);checks++;
    await page.getByLabel('I am 18 or older',{exact:true}).check();
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'accept the Terms'}).waitFor();checks++;
    await page.getByRole('checkbox').check();
    if(role==='student') await page.getByLabel('Username',{exact:true}).fill('legalbrowser');
    await page.getByLabel('Email',{exact:true}).fill('legal-browser@example.test');
    await page.getByLabel('Password',{exact:true}).fill('LegalBrowserTest#2026');
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    const signupResponse=page.waitForResponse(response=>response.url().includes('/auth/v1/signup'));
    if(role==='student') {
      const university=page.getByRole('combobox',{name:'University',exact:true});
      await university.fill('Adamawa');
      await page.getByRole('option').first().click();
      await page.getByLabel('Faculty',{exact:true}).fill('Science');
      await page.getByLabel('Department',{exact:true}).fill('Computer Science');
      await page.getByLabel('Current semester',{exact:true}).selectOption({index:1});
      await page.getByRole('button',{name:'Create account',exact:true}).click();
    } else {
      // Fill by registered field names to keep labels free to include optional hints.
      const fields={full_name:'Test Lecturer',university:'Test University',faculty:'Science',department:'Computing',position:'Lecturer',requested_courses:'COS 101'};
      for(const [name,value] of Object.entries(fields)) await page.locator(`[name="${name}"]`).fill(value);
      await page.getByRole('button',{name:'Submit lecturer application',exact:true}).click();
    }
    await signupResponse;
    const signup=signups.at(-1);
    assert.equal(signup.data.terms_accepted,true);assert.equal(signup.data.terms_version,version);
    assert.equal(signup.data.privacy_version,version);assert.equal(signup.data.age_declaration,'adult');checks+=4;
  }
  unavailable=true;
  await page.goto(origin+'/sign-up?role=student',{waitUntil:'networkidle'});
  await page.getByRole('alert').filter({hasText:'temporarily unavailable'}).waitFor();checks++;
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  assert.equal(signups.length,2);checks++;
  assert.ok(legalReads>=3);
  const result={checks,legalPages:'anonymous desktop/mobile and print passed',registration:'mocked Supabase responses: adult student/lecturer payloads, required acceptance, under-18 closed, missing migration fail-closed',liveDatabase:false};
  await writeFile('.legal-verification/browser-result.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
