import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createSmallzTraceIngress, createSmallzTraceIngressFromEnv} from '../hercules-bot/prompt-trace-ingress.mjs';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';

const key=Buffer.alloc(32,11);
const projectUrl='https://xbwuablxhhwsaoomsoco.supabase.co';
const serverKey='service-role-injected-test-key';
const envelope=(event,sequence=1,source='smallz')=>({
  source,sequence,event,
  mac:createHmac('sha256',key).update(JSON.stringify({source,sequence,event})).digest('hex')
});
const fixture=(fetchImpl)=>createSmallzTraceIngress({projectUrl,serverKey,signingKey:key,fetchImpl});

test('trace ingress remains off with missing or partial server-only configuration',()=>{
  assert.equal(createSmallzTraceIngressFromEnv({}),null);
  assert.equal(createSmallzTraceIngressFromEnv({HERCULES_PROMPT_TRACE_PROJECT_URL:projectUrl}),null);
  assert.equal(createSmallzTraceIngressFromEnv({HERCULES_PROMPT_TRACE_SERVER_KEY:serverKey,HERCULES_PROMPT_TRACE_HMAC_KEY_B64:key.toString('base64')}),null);
});
test('trusted signed event is checked, claimed through fixed HTTPS RPC and reported without raw page data',async()=>{
  let call;
  const ingress=fixture(async(url,opts)=>{call={url,opts};return {ok:true,json:async()=>true};});
  const receipt=await ingress(envelope({kind:'page_text',text:'untrusted page token=ultra-private'}));
  assert.equal(call.url,projectUrl+'/rest/v1/rpc/hercules_prompt_trace_claim_sequence');
  assert.equal(call.opts.method,'POST');
  assert.equal(call.opts.redirect,'error');
  assert.equal(call.opts.headers.apikey,serverKey);
  assert.deepEqual(JSON.parse(call.opts.body),{p_source:'smallz',p_sequence:1});
  assert.equal(receipt.accepted,true);
  assert.equal(receipt.kind,'message');
  assert.equal(receipt.sequence,1);
  assert.match(receipt.digest,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(receipt),/token=|ultra-private|service-role-injected/);
});
test('bad MAC and wrong emitter never call privileged RPC',async()=>{
  let count=0;
  const ingress=fixture(async()=>{count++;return {ok:true,json:async()=>true};});
  await assert.rejects(ingress({...envelope({kind:'page_text',text:'hi'}),mac:'0'.repeat(64)}));
  await assert.rejects(ingress(envelope({kind:'page_text',text:'hi'},1,'unauthorized')));
  assert.equal(count,0);
});
test('denies duplicate or delayed events and never reports success',async()=>{
  const ingress=fixture(async()=>({ok:true,json:async()=>false}));
  await assert.rejects(ingress(envelope({kind:'agent_message',text:'ignored'})),/replayed_event/);
});
test('network, redirect, HTTP and malformed RPC responses fail closed without revealing remote body',async()=>{
  for(const response of [
    {ok:false,status:401,json:async()=>({secret:'should-not-leak'})},
    {ok:true,json:async()=>({data:true})},
    {ok:true,json:async()=>1}
  ]){
    const ingress=fixture(async()=>response);
    await assert.rejects(ingress(envelope({kind:'page_text',text:'test'})));
  }
  const ingress=fixture(async()=>{throw new Error('internal-network-details');});
  await assert.rejects(ingress(envelope({kind:'page_text',text:'test'})));
});
test('valid tool attempt is retained only as denied metadata',async()=>{
  const ingress=fixture(async()=>({ok:true,json:async()=>true}));
  const receipt=await ingress(envelope({kind:'tool_attempt',action:'deploy',payload:{approved:true,password:'SECRET'}}));
  assert.equal(receipt.allowed,false);
  assert.doesNotMatch(JSON.stringify(receipt),/password|SECRET|approved/);
});
test('rejects unknown destination, project credentials in URL and undersized signing keys',()=>{
  for(const url of ['http://localhost','https://evil.example','https://xbwuablxhhwsaoomsoco.supabase.co/another','https://user:pass@xbwuablxhhwsaoomsoco.supabase.co','https://xbwuablxhhwsaoomsoco.supabase.co?x=1']){
    assert.throws(()=>createSmallzTraceIngress({projectUrl:url,serverKey,signingKey:key,fetchImpl:async()=>({ok:true,json:async()=>true})}),/invalid_trace_project/);
  }
  assert.throws(()=>createSmallzTraceIngress({projectUrl,serverKey,signingKey:Buffer.alloc(4)}),/invalid_trace_key/);
});
test('Smallz owner endpoint refuses unauthenticated traces even when a valid ingress exists',async()=>{
  const app=createHerculesBotApp({
    boundary:{authenticateOwner:async()=>{throw Object.assign(new Error('denied'),{statusCode:401});}},
    traceIngress:fixture(async()=>{throw new Error('should-not-fetch');})
  });
  const response=await app.handle({method:'POST',url:'/api/prompt-intelligence/trace',body:envelope({kind:'page_text',text:'hello'})});
  assert.equal(response.status,401);
});
test('Smallz endpoint returns unavailable when trace ingress is not configured',async()=>{
  const app=createHerculesBotApp({boundary:{authenticateOwner:async()=>({id:'owner'})},traceIngress:null,renderEnv:{}});
  const response=await app.handle({method:'POST',url:'/api/prompt-intelligence/trace',authorization:'Bearer owner',body:envelope({kind:'page_text',text:'hello'})});
  assert.equal(response.status,503);
});
test('Smallz owner endpoint returns minimal signed receipt without reflecting browser content',async()=>{
  const app=createHerculesBotApp({
    boundary:{authenticateOwner:async()=>({id:'owner'})},
    traceIngress:fixture(async()=>({ok:true,json:async()=>true}))
  });
  const response=await app.handle({method:'POST',url:'/api/prompt-intelligence/trace',authorization:'Bearer owner',body:envelope({kind:'page_text',text:'secret page content'})});
  assert.equal(response.status,200);
  assert.equal(response.body.accepted,true);
  assert.doesNotMatch(JSON.stringify(response),/secret page content/);
});
test('Smallz owner endpoint masks RPC failures and unknown input errors',async()=>{
  const app=createHerculesBotApp({
    boundary:{authenticateOwner:async()=>({id:'owner'})},
    traceIngress:fixture(async()=>{throw new Error('database secret exception text');})
  });
  const response=await app.handle({method:'POST',url:'/api/prompt-intelligence/trace',authorization:'Bearer owner',body:envelope({kind:'page_text',text:'hello'})});
  assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(response),/database secret exception/);
});
