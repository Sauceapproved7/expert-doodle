import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioVideoBridge} from '../hercules-video/studio-video-bridge.mjs';
import {createStudioHttpHandler,startStudioServer} from '../hercules-video/studio-server.mjs';

const token='Bearer header.payload.signature';
const health={ok:true,service:'hercules-video-bridge',engine:'hercules-video',executionPolicy:'fail-closed',orchestrationConnected:true,renderCapacityAvailable:false,benchmarkRenderAvailable:true};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('Studio reads the real bridge without mistaking benchmark capacity for production',async()=>{
  const bridge=createStudioVideoBridge({fetchImpl:async(url,options)=>{
    assert.equal(url,'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-preview-cell/video/health');
    assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,undefined);
    return response({...health,privateField:'must not escape'});
  }});
  const handle=createStudioHttpHandler({videoBridge:bridge});
  const result=await handle({pathname:'/api/studio/video/status'});const body=JSON.parse(result.body);
  assert.equal(result.status,200);assert.equal(body.bridgeConnected,true);
  assert.equal(body.productionReady,false);assert.equal(body.benchmarkRegistered,true);
  assert.equal(body.privateField,undefined);
  const start=await handle({method:'POST',pathname:'/api/studio/start'});assert.equal(start.status,423);
});
test('anonymous benchmark is refused before upstream access',async()=>{
  let calls=0;const bridge=createStudioVideoBridge({fetchImpl:async()=>{calls++;throw new Error();}});
  const handle=createStudioHttpHandler({videoBridge:bridge});
  const result=await handle({method:'POST',pathname:'/api/studio/video/benchmark',body:'{}'});
  assert.equal(result.status,401);assert.equal(calls,0);
});
test('benchmark forwards caller authorization only to the fixed owned bridge',async()=>{
  let calls=0;
  const bridge=createStudioVideoBridge({fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-preview-cell/video/render');
    assert.equal(options.headers.authorization,token);assert.equal(options.redirect,'error');
    assert.equal(JSON.parse(options.body).mode,'benchmark');
    return response({ok:true,benchmarkOnly:true,productionCapacityCertified:false,job:{id:'job',status:'succeeded'}});
  }});
  const handle=createStudioHttpHandler({videoBridge:bridge});
  const result=await handle({method:'POST',pathname:'/api/studio/video/benchmark',headers:{authorization:token},body:'{"projectId":"test"}'});
  assert.equal(result.status,200);assert.equal(calls,1);
  assert.equal(JSON.parse(result.body).benchmarkOnly,true);
  assert.ok(!result.body.includes(token));
});
test('invalid payload, production mode, oversized request and upstream rejection fail closed',async()=>{
  let calls=0;
  const bridge=createStudioVideoBridge({fetchImpl:async()=>{calls++;return response({error:'owner_or_admin_required'},401);}});
  for(const body of ['null','[]','bad','{"mode":"production"}',' '.repeat(16385)]){
    const result=await bridge.benchmark({headers:{authorization:token},body});
    assert.ok([400,413].includes(result.status));
  }
  assert.equal(calls,0);
  const denied=await bridge.benchmark({headers:{authorization:token},body:'{}'});
  assert.equal(denied.status,401);
});
test('network failure and malformed success cannot become successful evidence',async()=>{
  for(const fetchImpl of [async()=>{throw new Error('private connection details');},async()=>response({ok:true}),async()=>response({...health,executionPolicy:'open'}),async()=>new Response('x'.repeat(65537))]){
    const bridge=createStudioVideoBridge({fetchImpl});
    const status=await bridge.status();assert.equal(status.body.bridgeConnected,false);
    const result=await bridge.benchmark({headers:{authorization:token},body:'{}'});
    assert.equal(result.status,502);assert.ok(!JSON.stringify(result).includes('private connection'));
  }
});

 test('HTTP server carries the bridge into live request handling',async(t)=>{
  const bridge=createStudioVideoBridge({fetchImpl:async()=>response(health)});
  const {server}=await startStudioServer({host:'127.0.0.1',port:0,videoBridge:bridge});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const status=await fetch(origin+'/api/studio/video/status');
  assert.equal(status.status,200);assert.equal((await status.json()).bridgeConnected,true);
  const denied=await fetch(origin+'/api/studio/video/benchmark',{method:'POST',body:'{}'});
  assert.equal(denied.status,401);
 });
