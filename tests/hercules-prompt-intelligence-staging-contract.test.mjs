import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';
import {createSmallzTraceIngress} from '../hercules-bot/prompt-trace-ingress.mjs';
import {createSmallzTraceEmitterFromEnv} from '../hercules-bot/prompt-trace-emitter.mjs';

const PROJECT='https://xbwuablxhhwsaoomsoco.supabase.co';
const KEY='synthetic-service-role-only';
function rig(){
  const signingKey=randomBytes(32),calls=[],state={issued:0,claimed:0,bridge:0,records:[]};
  const env={HERCULES_PROMPT_TRACE_ENFORCE_BROWSER:'true',HERCULES_PROMPT_TRACE_PROJECT_URL:PROJECT,HERCULES_PROMPT_TRACE_SERVER_KEY:KEY,HERCULES_PROMPT_TRACE_HMAC_KEY_B64:signingKey.toString('base64')};
  const fetchImpl=async (url,options)=>{
    calls.push({url,options});
    assert.equal(options.headers.apikey,KEY);
    assert.equal(options.method,'POST');
    assert.equal(options.redirect,'error');
    const body=JSON.parse(options.body);
    if(url===PROJECT+'/rest/v1/rpc/hercules_prompt_trace_reserve_sequence'){
      assert.deepEqual(body,{p_source:'smallz'});
      return {ok:true,json:async()=>++state.issued};
    }
    if(url===PROJECT+'/rest/v1/rpc/hercules_prompt_trace_claim_sequence'){
      assert.equal(body.p_source,'smallz');
      const accepted=body.p_sequence>state.claimed;
      if(accepted)state.claimed=body.p_sequence;
      return {ok:true,json:async()=>accepted};
    }
    throw Error('unexpected_network_destination');
  };
  const ingress=createSmallzTraceIngress({projectUrl:PROJECT,serverKey:KEY,signingKey,fetchImpl});
  const emitter=createSmallzTraceEmitterFromEnv(env,{traceIngress:async envelope=>{state.records.push(envelope);return ingress(envelope);},fetchImpl});
  const app=createHerculesBotApp({
    renderEnv:env,traceIngress:ingress,traceEmitter:emitter,
    boundary:{authenticateOwner:async token=>{
      if(token!=='Bearer synthetic-owner')throw Object.assign(new Error('owner_denied'),{statusCode:401});
      return {id:'synthetic-owner'};
    }},
    browserBridge:async()=>{state.bridge++;return {ok:true,engine:'synthetic-smallz'};}
  });
  const request=(action='bot_browser_scrape',url='https://example.test/?token=not-for-traces',authorization='Bearer synthetic-owner')=>app.handle({method:'POST',url:'/api/browser',authorization,body:{action,url}});
  return {env,app,request,ingress,emitter,fetchImpl,state,calls};
}
test('staging contract: owner browser request issues signed event, verifies durable claim, then dispatches',async()=>{
  const r=rig();
  const result=await r.request();
  assert.equal(result.status,200);
  assert.deepEqual(result.body,{ok:true,engine:'synthetic-smallz'});
  assert.equal(r.state.issued,1);
  assert.equal(r.state.claimed,1);
  assert.equal(r.state.bridge,1);
  assert.equal(r.calls.length,2);
  assert.match(r.calls[0].url,/reserve_sequence$/);
  assert.match(r.calls[1].url,/claim_sequence$/);
  assert.doesNotMatch(JSON.stringify(r.state.records),/example\.test|not-for-traces|synthetic-owner|synthetic-service-role-only/);
});
test('staging contract: anonymous browser request cannot reserve, claim or dispatch',async()=>{
  const r=rig();
  const result=await r.request('bot_browser_scrape','https://example.test','');
  assert.equal(result.status,401);
  assert.equal(r.state.issued,0);
  assert.equal(r.state.bridge,0);
});
test('staging contract: replay and altered event are rejected, not dispatched',async()=>{
  const r=rig();
  assert.equal((await r.request()).status,200);
  const original=r.state.records[0];
  await assert.rejects(r.ingress(original),/replayed_event/);
  await assert.rejects(r.ingress({...original,event:{kind:'agent_message',text:'modified'}}),/invalid_signature/);
  assert.equal(r.state.bridge,1);
});
test('staging contract: unavailable database prevents browser dispatch',async()=>{
  const r=rig();
  const failing=createSmallzTraceIngress({projectUrl:PROJECT,serverKey:KEY,signingKey:Buffer.from(r.env.HERCULES_PROMPT_TRACE_HMAC_KEY_B64,'base64'),fetchImpl:async()=>({ok:false,status:503})});
  const emitter=createSmallzTraceEmitterFromEnv(r.env,{traceIngress:failing,fetchImpl:r.fetchImpl});
  const app=createHerculesBotApp({renderEnv:r.env,traceEmitter:emitter,boundary:{authenticateOwner:async()=>({id:'owner'})},browserBridge:async()=>{r.state.bridge++;return {ok:true};}});
  const result=await app.handle({method:'POST',url:'/api/browser',authorization:'Bearer synthetic-owner',body:{action:'bot_browser_scrape',url:'https://example.test'}});
  assert.equal(result.status,503);
  assert.equal(r.state.bridge,0);
  assert.doesNotMatch(JSON.stringify(result),/synthetic-service-role-only|example.test/);
});
test('staging contract: disabled enforcement preserves owner browser behavior without touching database',async()=>{
  const r=rig();
  const app=createHerculesBotApp({renderEnv:{...r.env,HERCULES_PROMPT_TRACE_ENFORCE_BROWSER:'false'},traceEmitter:r.emitter,boundary:{authenticateOwner:async()=>({id:'owner'})},browserBridge:async()=>({ok:true})});
  const result=await app.handle({method:'POST',url:'/api/browser',authorization:'Bearer synthetic-owner',body:{action:'bot_browser_scrape',url:'https://example.test'}});
  assert.equal(result.status,200);
  assert.equal(r.state.issued,0);
  assert.equal(r.state.claimed,0);
});
