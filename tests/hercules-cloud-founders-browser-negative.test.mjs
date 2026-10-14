import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

// DA-47: Run the real, published form in Chromium without submitting a fake
// founder. A real network POST is permitted ONLY with an empty email and false
// consent. Every valid-looking form request is intercepted inside Chromium
// before it can reach PostgREST.
// The repository checkout stays clean: browser dependencies are installed
// only in the GitHub runner's ephemeral temp directory.
const ciRuntime=process.env.HERCULES_CI_BROWSER_RUNTIME;
assert.ok(ciRuntime,'isolated Hercules Browser CI runtime must be configured');
const loadBrowser=createRequire(ciRuntime+'/package.json');
const {chromium}=loadBrowser('playwright-core');
const ORIGIN='https://hercules-cloud-origin-preview.onrender.com';
const RPC='https://xbwuablxhhwsaoomsoco.supabase.co/rest/v1/rpc/hercules_cloud_join_founders';
const FORM_RESULT='#founders-result';
const REPLIES={
  simulatedSuccess:{http:200,body:{ok:true,status:'interest_recorded_unverified'}},
  simulatedRejection:{http:200,body:{ok:false,error:'consent_required'}},
  simulatedFull:{http:429,body:{ok:false,error:'intake_temporarily_full'}}
};
const messages={
  simulatedSuccess:'Interest recorded. Your address is currently unverified; this does not create a Hercules account or grant hosted access.',
  simulatedRejection:'We could not record your request. Please try again later.',
  simulatedFull:'The interest list is temporarily full. Please try again later.'
};

test('real Chromium: safe public-origin rejection and isolated form feedback (no stored founder)',{timeout:120000},async()=>{
  const executablePath=process.env.HERCULES_CI_CHROME;
  assert.ok(executablePath,'CI Chromium executable must be explicitly discovered, not guessed');
  const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  const page=await context.newPage();
  const onlySynthetic='simulation@example.invalid';
  const mockedRequests=[];
  try{
    const response=await page.goto(ORIGIN+'/founders.html',{waitUntil:'load',timeout:30000});
    assert.equal(response?.status(),200,'public founders HTML must load in Chromium');
    assert.equal(await page.title(),'Hercules Cloud | Founding Circle');
    assert.equal(await page.locator('#founders-form').count(),1);
    // Native HTML validation must reject an empty email and unchecked consent.
    await page.locator('#founders-submit').click();
    const emptyValidation=await page.locator('#founders-email').evaluate(el=>el.validity.valueMissing);
    assert.equal(emptyValidation,true,'blank email must be rejected without sending');
    await page.locator('#founders-email').fill(onlySynthetic);
    await page.locator('#founders-submit').click();
    const consentValidation=await page.locator('#founders-consent').evaluate(el=>el.validity.valueMissing);
    assert.equal(consentValidation,true,'unchecked consent must be rejected without sending');

    // The only real browser->PostgREST request in this test. Both values rule
    // out insertion even if one server-side validation branch regresses.
    const negative=await page.evaluate(async ({endpoint})=>{
      const moduleText=await (await fetch('/founders.mjs',{cache:'no-store'})).text();
      const key=moduleText.match(/const publishableKey='([^']+)'/)?.[1];
      if(!key||!key.startsWith('sb_publishable_'))throw Error('public-key-missing');
      const res=await fetch(endpoint,{
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
        headers:{'content-type':'application/json',apikey:key},
        body:JSON.stringify({p_email:'',p_consent:false,p_interest:'both',p_website:''})
      });
      return {http:res.status,payload:await res.json()};
    },{endpoint:RPC});
    assert.equal(negative.http,200);
    assert.deepEqual(negative.payload,{ok:false,error:'consent_required'});

    // Install interception before checking ANY consented-looking test form.
    // Fake addresses never exit this Chromium session, regardless of response.
    let mode='simulatedSuccess';
    await page.route(RPC,async route=>{
      const req=route.request();
      const headers={
        'access-control-allow-origin':ORIGIN,
        'access-control-allow-methods':'POST, OPTIONS',
        'access-control-allow-headers':'apikey,content-type'
      };
      if(req.method()==='OPTIONS'){
        return route.fulfill({status:204,headers});
      }
      const posted=JSON.parse(req.postData()||'{}');
      mockedRequests.push({method:req.method(),email:posted.p_email,consent:posted.p_consent,mode});
      if(req.method()!=='POST'||posted.p_email!==onlySynthetic||posted.p_consent!==true){
        return route.abort('blockedbyclient');
      }
      const reply=REPLIES[mode];
      return route.fulfill({status:reply.http,contentType:'application/json',headers,body:JSON.stringify(reply.body)});
    });
    for(const next of Object.keys(REPLIES)){
      mode=next;
      await page.locator('#founders-email').fill(onlySynthetic);
      await page.locator('#founders-consent').check();
      await page.locator('#founders-submit').click();
      await page.waitForFunction(expected=>document.querySelector('#founders-result')?.textContent===expected,messages[next],{timeout:8000});
      assert.equal(await page.locator(FORM_RESULT).textContent(),messages[next]);
      assert.equal(await page.locator('#founders-submit').isEnabled(),true,'submission button must recover');
      assert.equal(mockedRequests.at(-1)?.mode,next,'the mocked scenario must be exercised');
    }
    assert.equal(mockedRequests.length,3);
    assert.ok(mockedRequests.every(x=>x.email===onlySynthetic&&x.consent===true&&x.method==='POST'));
    console.log(JSON.stringify({
      origin:ORIGIN,browser:'Chromium via pinned Hercules Browser runtime',
      publicPageHttp:200,realNegativePostHttp:negative.http,negativeError:negative.payload.error,
      nativeEmailAndConsentValidation:true,mockedDomCases:Object.keys(REPLIES),
      syntheticPostsIntercepted:mockedRequests.length,validPostsToPostgrest:0,
      fakeLeadsCreated:0,emailTransportUsed:false
    }));
  }finally{
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
});
