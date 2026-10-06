import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const source=await readFile(new URL('../supabase/functions/hercules-preview-cell/index.ts',import.meta.url),'utf8');
const route=stripTypeScriptTypes(source.slice(source.indexOf('Deno.serve(async(req:Request)=>{')));
function handler({actor={user:{id:'owner'}},capacity={rendererAvailable:false,benchmarkRendererAvailable:true},run=async()=>({job:{status:'succeeded'}})}={}) {
  let handle,calls=0;
  vm.runInNewContext(route,{
    Deno:{serve:fn=>{handle=fn;}},URL,Response,
    operator:async()=>actor,
    out:(body,status=200)=>new Response(JSON.stringify(body),{status}),
    createVideoRenderRequest:async()=>({requestFingerprint:'fingerprint',projectId:'project',shot:{id:'shot'}}),
    videoCapacity:async()=>capacity,
    runBenchmarkRender:async(...args)=>{calls++;return run(...args);},
    db:{from:()=>({insert:async()=>({})})},ORG:'test-org'
  });
  return {handle,calls:()=>calls};
}
const request=mode=>new Request('https://owned.example/functions/v1/hercules-preview-cell/video/render',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode})});

test('authenticated benchmark reaches the existing dispatcher without production capacity',async()=>{
  const h=handler();const response=await h.handle(request('benchmark'));
  assert.equal(response.status,200);assert.equal(h.calls(),1);
  const body=await response.json();assert.equal(body.benchmarkOnly,true);assert.equal(body.productionCapacityCertified,false);
});
test('anonymous benchmark cannot dispatch',async()=>{
  const h=handler({actor:null});const response=await h.handle(request('benchmark'));
  assert.equal(response.status,401);assert.equal(h.calls(),0);
});
test('missing benchmark capacity fails closed',async()=>{
  const h=handler({capacity:{rendererAvailable:false,benchmarkRendererAvailable:false}});
  const response=await h.handle(request('benchmark'));
  assert.equal(response.status,503);assert.equal(h.calls(),0);
});
test('production and default modes never fall back to benchmark',async()=>{
  for(const mode of ['production',undefined]){
    const h=handler();const response=await h.handle(request(mode));
    assert.equal(response.status,503);assert.equal(h.calls(),0);
  }
});
test('unknown modes are rejected',async()=>{
  const h=handler();const response=await h.handle(request('surprise'));
  assert.equal(response.status,400);assert.equal(h.calls(),0);
});
test('provider errors cannot expose raw provider details to the caller',async()=>{
  const h=handler({run:async()=>{throw new Error('provider error with private details');}});
  const response=await h.handle(request('benchmark'));
  assert.equal(response.status,502);assert.equal((await response.json()).error,'benchmark_render_failed');
});
