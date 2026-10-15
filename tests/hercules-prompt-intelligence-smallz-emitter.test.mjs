import test from 'node:test';
import assert from 'node:assert/strict';
import {createSmallzTraceEmitter,createSmallzTraceEmitterFromEnv} from '../hercules-bot/prompt-trace-emitter.mjs';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';
import {createHmac} from 'node:crypto';

const secret=Buffer.alloc(32,27);
test('trusted emitter signs bounded browser intent only, never raw browser URL or response',async()=>{
  let signed,allocated;
  const emitter=createSmallzTraceEmitter({
    signingKey:secret,
    reserveSequence:async source=>{allocated=source;return 17;},
    ingestTrace:async e=>{signed=e;return {accepted:true,sequence:17,source:'browser:smallz'};}
  });
  const result=await emitter({action:'bot_browser_navigate',url:'https://example.test/?secret=1',pageText:'secret page'});
  assert.equal(allocated,'smallz');
  assert.equal(result.accepted,true);
  assert.deepEqual(signed.event,{kind:'agent_message',text:'smallz_owner_browser_intent:bot_browser_navigate'});
  assert.equal(signed.sequence,17);
  assert.equal(signed.source,'smallz');
  assert.equal(signed.mac,createHmac('sha256',secret).update(JSON.stringify({source:signed.source,sequence:signed.sequence,event:signed.event})).digest('hex'));
  assert.doesNotMatch(JSON.stringify(signed),/example.test|secret page|secret=1/);
});
test('unsupported actions are denied before reserving a sequence',async()=>{
  let count=0;
  const emitter=createSmallzTraceEmitter({signingKey:secret,reserveSequence:async()=>{count++;return 1;},ingestTrace:async()=>({accepted:true,sequence:1})});
  for(const action of ['bot_browser_click','bot_deploy_publish','',null]){
    await assert.rejects(emitter({action}),/unsupported_trace_action/);
  }
  assert.equal(count,0);
});
test('missing dependency, invalid source sequence, and unverifiable receipt deny admission',async()=>{
  assert.throws(()=>createSmallzTraceEmitter({signingKey:Buffer.alloc(4),reserveSequence:async()=>1,ingestTrace:async()=>true}),/invalid_trace_key/);
  for(const n of [null,0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'1']){
    const emitter=createSmallzTraceEmitter({signingKey:secret,reserveSequence:async()=>n,ingestTrace:async()=>({accepted:true,sequence:1})});
    await assert.rejects(emitter({action:'bot_browser_scrape'}),/invalid_trace_sequence/);
  }
  const emitter=createSmallzTraceEmitter({signingKey:secret,reserveSequence:async()=>2,ingestTrace:async()=>({accepted:true,sequence:1})});
  await assert.rejects(emitter({action:'bot_browser_scrape'}),/trace_receipt_unverified/);
});
test('configured emitter requests sequence from a fixed service-only RPC and does not disclose the key',async()=>{
  const calls=[];
  const env={
    HERCULES_PROMPT_TRACE_PROJECT_URL:'https://xbwuablxhhwsaoomsoco.supabase.co',
    HERCULES_PROMPT_TRACE_SERVER_KEY:'test-service-role-only',
    HERCULES_PROMPT_TRACE_HMAC_KEY_B64:secret.toString('base64')
  };
  const emitter=createSmallzTraceEmitterFromEnv(env,{
    traceIngress:async envelope=>({accepted:true,sequence:envelope.sequence,source:'browser:smallz'}),
    fetchImpl:async (url,init)=>{calls.push({url,init});return {ok:true,json:async()=>9};}
  });
  assert.ok(typeof emitter==='function');
  const receipt=await emitter({action:'bot_browser_scrape'});
  assert.equal(receipt.sequence,9);
  assert.equal(calls[0].url,env.HERCULES_PROMPT_TRACE_PROJECT_URL+'/rest/v1/rpc/hercules_prompt_trace_reserve_sequence');
  assert.deepEqual(JSON.parse(calls[0].init.body),{p_source:'smallz'});
  assert.equal(calls[0].init.headers.apikey,env.HERCULES_PROMPT_TRACE_SERVER_KEY);
  assert.doesNotMatch(JSON.stringify(receipt),/test-service-role/);
});
test('emitter cannot be configured with missing server-only values',()=>{
  assert.equal(createSmallzTraceEmitterFromEnv({}, {traceIngress:async()=>({})}),null);
  assert.equal(createSmallzTraceEmitterFromEnv({
    HERCULES_PROMPT_TRACE_PROJECT_URL:'https://xbwuablxhhwsaoomsoco.supabase.co',
    HERCULES_PROMPT_TRACE_SERVER_KEY:'missing-secret'
  },{traceIngress:async()=>({})}),null);
});
test('Smallz trace admission runs before browser execution and cannot leak request URL',async()=>{
  const order=[];
  const app=createHerculesBotApp({
    boundary:{authenticateOwner:async()=>({id:'owner'})},
    renderEnv:{HERCULES_PROMPT_TRACE_ENFORCE_BROWSER:'true'},
    traceEmitter:async({action})=>{order.push('trace:'+action);return {accepted:true};},
    browserBridge:async()=>{order.push('browser');return {ok:true};}
  });
  const response=await app.handle({method:'POST',url:'/api/browser',authorization:'Bearer owner',body:{action:'bot_browser_navigate',url:'https://example.test/?token=private'}});
  assert.equal(response.status,200);
  assert.deepEqual(order,['trace:bot_browser_navigate','browser']);
  assert.doesNotMatch(JSON.stringify(response),/token=private/);
});
test('required but absent or failed trace blocks the browser call',async()=>{
  let browserCalls=0;
  const args={
    boundary:{authenticateOwner:async()=>({id:'owner'})},
    renderEnv:{HERCULES_PROMPT_TRACE_ENFORCE_BROWSER:'true'},
    browserBridge:async()=>{browserCalls++;return {ok:true};}
  };
  const req={method:'POST',url:'/api/browser',authorization:'Bearer owner',body:{action:'bot_browser_scrape',url:'https://example.test'}};
  const unavailable=createHerculesBotApp({...args,traceEmitter:null});
  assert.equal((await unavailable.handle(req)).status,503);
  const failed=createHerculesBotApp({...args,traceEmitter:async()=>{throw new Error('sensitive external failure');}});
  const response=await failed.handle(req);
  assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(response),/sensitive external failure/);
  assert.equal(browserCalls,0);
});
test('trace admission is opt-in and does not alter existing owner browser response when off',async()=>{
  let auditCalls=0;
  const app=createHerculesBotApp({
    boundary:{authenticateOwner:async()=>({id:'owner'})},
    renderEnv:{HERCULES_PROMPT_TRACE_ENFORCE_BROWSER:'false'},
    traceEmitter:async()=>{auditCalls++;},
    browserBridge:async()=>({ok:true,engine:'smallz'})
  });
  const response=await app.handle({method:'POST',url:'/api/browser',authorization:'Bearer owner',body:{action:'bot_browser_scrape',url:'https://example.test'}});
  assert.equal(response.status,200);
  assert.deepEqual(response.body,{ok:true,engine:'smallz'});
  assert.equal(auditCalls,0);
});

test('one Smallz worker serializes signed issuance so concurrent owner requests stay ordered',async()=>{
  let next=0,releaseFirst;
  const holdFirst=new Promise(resolve=>{releaseFirst=resolve;});
  const accepted=[];
  const emitter=createSmallzTraceEmitter({
    signingKey:secret,
    reserveSequence:async()=>++next,
    ingestTrace:async event=>{
      if(event.sequence===1)await holdFirst;
      accepted.push(event.sequence);
      return {accepted:true,sequence:event.sequence,source:'browser:smallz'};
    }
  });
  const first=emitter({action:'bot_browser_navigate'});
  const second=emitter({action:'bot_browser_scrape'});
  await new Promise(resolve=>setImmediate(resolve));
  releaseFirst();
  await Promise.all([first,second]);
  assert.deepEqual(accepted,[1,2]);
});
