import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  probeQwen15EngineIdentity,QWEN15_MODEL_ALIAS
} from "../hercules-models/qwen15-owner-host.mjs";

const url="http://127.0.0.1:18776";
function response(body,status=200){
  return {ok:status>=200&&status<300,status,json:async()=>body};
}
const health={status:"ok"};
const inventory={object:"list",data:[{id:QWEN15_MODEL_ALIAS,object:"model"}]};
function stub(healthResponse=response(health),inventoryResponse=response(inventory),calls=[]){
  return async(path,opts)=>{
    calls.push({path,opts});
    if(path===url+"/health")return healthResponse;
    if(path===url+"/v1/models")return inventoryResponse;
    throw Error("unexpected external or non-loopback URL");
  };
}
test("pinned identity probe accepts only healthy exact advertised local llama.cpp alias",async()=>{
  const calls=[];
  const passed=await probeQwen15EngineIdentity({fetchImpl:stub(response(health),response(inventory),calls)});
  assert.equal(passed,true);
  assert.deepEqual(calls.map(x=>x.path),[url+"/health",url+"/v1/models"]);
  assert.ok(calls.every(x=>x.opts.redirect==="error"&&
    x.opts.signal instanceof AbortSignal&&x.opts.method==="GET"));
});
test("a health 200 cannot admit the wrong model, empty inventory, or multiple models",async()=>{
  for(const data of [
    {object:"list",data:[{id:"impostor-model",object:"model"}]},
    {object:"list",data:[]},
    {object:"list",data:[{id:QWEN15_MODEL_ALIAS},{id:"unapproved"}]},
    {object:"list",data:[{id:QWEN15_MODEL_ALIAS},{id:QWEN15_MODEL_ALIAS}]},
    {object:"list",data:[{id:QWEN15_MODEL_ALIAS+" "}]} ,
    {},
    null,
    "fake"
  ]){
    assert.equal(await probeQwen15EngineIdentity({
      fetchImpl:stub(response(health),response(data))
    }),false,JSON.stringify(data));
  }
});
test("loading, busy, invalid or malformed health never exposes private API",async()=>{
  for(const bad of [
    response({status:"loading model"}),
    response({status:"error"}),
    response({status:"ok",error:"still loading"}),
    response({ok:true}),
    response(null),
    response("ok"),
    response(health,503)
  ]){
    const calls=[];
    assert.equal(await probeQwen15EngineIdentity({
      fetchImpl:stub(bad,response(inventory),calls)
    }),false);
    assert.equal(calls.length,1);
  }
});
test("transport failures, HTTP errors, malformed JSON, and redirects fail closed",async()=>{
  for(const caseData of [
    {fetchImpl:async()=>{throw Error("offline")}},
    {fetchImpl:stub(response(health),response(inventory,404))},
    {fetchImpl:stub(response(health),{ok:true,status:200,json:async()=>{throw Error("bad json")}})},
    {fetchImpl:stub(response(health),response({data:"not array"}))},
    {fetchImpl:stub(response(health),response({data:[{}]}))}
  ])assert.equal(await probeQwen15EngineIdentity(caseData),false);
});
test("private launcher checks exact model inventory before exposing its control listener",()=>{
  const source=readFileSync(new URL("../scripts/hercules-qwen15-owner-host.mjs",import.meta.url),"utf8");
  assert.match(source,/probeQwen15EngineIdentity/);
  assert.ok(source.indexOf("await probeQwen15EngineIdentity(")>0);
  assert.ok(source.indexOf("await probeQwen15EngineIdentity(")<source.indexOf("control=listenModelPlaneService("));
  assert.match(source,/private_model_unavailable/);
  assert.match(source,/HERCULES_QWEN15_PRIVATE_TRIAL!==["']true["']/);
  assert.doesNotMatch(source,/0\.0\.0\.0|https?:\/\/(?!127\.0\.0\.1)|RENDER_API_KEY|SHOPIFY_API_KEY/);
});
test("focused CI and actual ARM64 model workflow enforce the model identity proof",()=>{
  const ci=readFileSync(new URL("../.github/workflows/hercules-qwen15-owner-host.yml",import.meta.url),"utf8");
  const arm=readFileSync(new URL("../.github/workflows/hercules-arm64-qwen15-comparison.yml",import.meta.url),"utf8");
  assert.ok(ci.includes("tests/hercules-qwen15-startup-identity.test.mjs"));
  assert.ok(arm.includes("tests/hercules-qwen15-startup-identity.test.mjs"));
  assert.ok(arm.includes("node scripts/hercules-qwen15-private-live-smoke.mjs"));
  assert.doesNotMatch(arm,/systemctl\s+(enable|start)|RENDER_API_KEY/);
});
