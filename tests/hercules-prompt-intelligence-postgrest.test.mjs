import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {createSmallzTraceIngress,createSmallzTraceRpc} from '../hercules-bot/prompt-trace-ingress.mjs';
import {createSmallzTraceEmitter} from '../hercules-bot/prompt-trace-emitter.mjs';
import {createHerculesBotApp} from '../hercules-bot/app-server.mjs';

const ENDPOINT=process.env.HERCULES_DISPOSABLE_POSTGREST_URL;
const SECRET=process.env.HERCULES_DISPOSABLE_JWT_SECRET;
const PROJECT='https://syntheticstaging123.supabase.co';
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(role){
  const head=b64({alg:'HS256',typ:'JWT'});
  const body=b64({role,exp:Math.floor(Date.now()/1000)+600});
  const signature=createHmac('sha256',SECRET).update(head+'.'+body).digest('base64url');
  return head+'.'+body+'.'+signature;
}
function wireFetch(url,options){
  assert.ok(url.startsWith(PROJECT+'/rest/v1/rpc/'));
  const path=url.slice((PROJECT+'/rest/v1').length);
  return fetch(ENDPOINT+path,options);
}
function withRole(role){
  const token=jwt(role);
  return (url,options)=>wireFetch(url,{...options,headers:{...options.headers,authorization:'Bearer '+token}});
}

test('real disposable PostgREST: service_role can reserve, claim and reject replay', {skip:!ENDPOINT||!SECRET}, async()=>{
  const rpc=createSmallzTraceRpc({projectUrl:PROJECT,serverKey:'synthetic-test-only',fetchImpl:withRole('service_role')});
  const source='postgrest_real';
  const sequence=await rpc('hercules_prompt_trace_reserve_sequence',{p_source:source});
  assert.ok(Number.isSafeInteger(sequence)&&sequence>0);
  assert.equal(await rpc('hercules_prompt_trace_claim_sequence',{p_source:source,p_sequence:sequence}),true);
  assert.equal(await rpc('hercules_prompt_trace_claim_sequence',{p_source:source,p_sequence:sequence}),false);
  assert.equal(await rpc('hercules_prompt_trace_claim_sequence',{p_source:source,p_sequence:sequence+2}),true);
  assert.equal(await rpc('hercules_prompt_trace_claim_sequence',{p_source:source,p_sequence:sequence+1}),true);
});
test('real disposable PostgREST: anon and authenticated cannot call trace RPC', {skip:!ENDPOINT||!SECRET}, async()=>{
  for(const role of ['anon','authenticated']){
    const response=await wireFetch(PROJECT+'/rest/v1/rpc/hercules_prompt_trace_claim_sequence',{
      method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+jwt(role)},
      body:JSON.stringify({p_source:'smallz',p_sequence:111})});
    assert.ok(response.status===401||response.status===403,{role,status:response.status});
    const reserve=await wireFetch(PROJECT+'/rest/v1/rpc/hercules_prompt_trace_reserve_sequence',{
      method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+jwt(role)},
      body:JSON.stringify({p_source:'smallz'})});
    assert.ok(reserve.status===401||reserve.status===403,{role,status:reserve.status});
  }
});
test('real disposable PostgREST: authenticated owner -> signed ingress -> replay claim -> browser dispatch', {skip:!ENDPOINT||!SECRET}, async()=>{
  const signingKey=randomBytes(32);
  const rpc=createSmallzTraceRpc({projectUrl:PROJECT,serverKey:'synthetic-test-only',fetchImpl:withRole('service_role')});
  const ingress=createSmallzTraceIngress({projectUrl:PROJECT,serverKey:'synthetic-test-only',signingKey,fetchImpl:withRole('service_role')});
  const emitter=createSmallzTraceEmitter({signingKey,reserveSequence:source=>rpc('hercules_prompt_trace_reserve_sequence',{p_source:source}),ingestTrace:ingress});
  let dispatched=0;
  const app=createHerculesBotApp({
    renderEnv:{HERCULES_PROMPT_TRACE_ENFORCE_BROWSER:'true'},
    traceEmitter:emitter,
    boundary:{authenticateOwner:async token=>{
      if(token!=='Bearer synthetic-owner')throw Object.assign(new Error('denied'),{statusCode:401});
      return {id:'synthetic-owner'};
    }},
    browserBridge:async()=>{dispatched++;return {ok:true};}
  });
  const req=(authorization,action='bot_browser_scrape')=>app.handle({method:'POST',url:'/api/browser',authorization,body:{action,url:'https://example.test/?secret=must-not-leak'}});
  assert.equal((await req('')).status,401);
  assert.equal(dispatched,0);
  const result=await req('Bearer synthetic-owner');
  assert.equal(result.status,200);
  assert.equal(dispatched,1);
  assert.deepEqual(result.body,{ok:true});
  await assert.rejects(emitter({action:'not_allowed'}),/unsupported_trace_action/);
  assert.equal(dispatched,1);
});
