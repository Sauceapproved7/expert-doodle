import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  assessQwen15PrivateSmoke,executeQwen15PrivateSmoke
} from "../scripts/hercules-qwen15-private-live-smoke.mjs";

const base={
  health:{status:200,body:{ok:true,service:"hercules-model-plane",nativeOnly:true}},
  noToken:{status:401,body:{error:"unauthorized"}},
  wrongToken:{status:401,body:{error:"unauthorized"}},
  emptyPrompt:{status:400,body:{error:"local_chat_prompt_invalid"}},
  readiness:{status:200,body:{
    enabled:true,backend:"loopback-only",protocol:"llama-cpp",
    modelConfigured:true,inferenceVerified:false,publicReleaseApproved:false
  }},
  chat:{status:200,body:{
    origin:"local-loopback",outputText:"4",inferenceVerified:true,publicReleaseApproved:false
  }},
  endpoint:"http://127.0.0.1:38900",elapsedMs:1800
};

test("all real request checks can establish private trial proof, not production or launch",()=>{
  const v=assessQwen15PrivateSmoke(base);
  assert.equal(v.schema,"hercules.qwen15.owner-host-live-smoke.v1");
  assert.equal(v.privateLoopbackAuthenticatedAndGenerated,true);
  assert.equal(v.ownerHostBillingVerified,false);
  assert.equal(v.productionInferenceVerified,false);
  assert.equal(v.publicReleaseApproved,false);
  assert.equal(v.aiDevbrainHealthy,false);
  assert.equal(v.paidCommerceEnabled,false);
});

test("unauthorized access, bad prompt, wrong output and false readiness all fail closed",()=>{
  for(const mutation of [
    {noToken:{status:200,body:{outputText:"4"}}},
    {wrongToken:{status:200,body:{outputText:"4"}}},
    {emptyPrompt:{status:200,body:{outputText:"4"}}},
    {chat:{status:200,body:{...base.chat.body,outputText:"5"}}},
    {chat:{status:200,body:{...base.chat.body,publicReleaseApproved:true}}},
    {chat:{status:200,body:{...base.chat.body,origin:"remote"}}},
    {readiness:{status:200,body:{...base.readiness.body,enabled:false}}},
    {readiness:{status:200,body:{...base.readiness.body,protocol:"ollama"}}},
    {readiness:{status:200,body:{...base.readiness.body,publicReleaseApproved:true}}},
    {health:{status:200,body:{...base.health.body,nativeOnly:false}}},
    {endpoint:"https://example.com"},{elapsedMs:0}
  ])assert.equal(assessQwen15PrivateSmoke({...base,...mutation}).privateLoopbackAuthenticatedAndGenerated,false);
});

test("missing and malformed evidence denies private inference proof",()=>{
  for(const value of [null,undefined,{},[],{...base,chat:null},
    {...base,chat:{...base.chat,body:null}},
    {...base,readiness:{status:503,body:null}}]){
    assert.equal(assessQwen15PrivateSmoke(value).privateLoopbackAuthenticatedAndGenerated,false);
  }
});

test("script performs real HTTP requests with bearer auth but never emits owner token",async()=>{
  const token="ab".repeat(32);
  const history=[];
  const fakeFetch=async(url,opts={})=>{
    const path=new URL(url).pathname;
    const authorization=opts.headers?.authorization??"";
    const method=opts.method??"GET";
    history.push({path,method,authorization,body:opts.body});
    let data;
    if(method==="GET"&&path==="/health")data=base.health;
    else if(method==="GET"&&path==="/v1/chat/readiness")data=base.readiness;
    else if(method==="POST"&&path==="/v1/chat"){
      if(!authorization||authorization==="Bearer wrong")data=base.noToken;
      else data=JSON.parse(opts.body)?.prompt?.trim()?base.chat:base.emptyPrompt;
    }else throw Error("unexpected request "+path);
    return {ok:data.status>=200&&data.status<300,status:data.status,
      json:async()=>data.body};
  };
  const result=await executeQwen15PrivateSmoke({token,fetchImpl:fakeFetch});
  assert.equal(result.privateLoopbackAuthenticatedAndGenerated,true);
  assert.equal(history.length,6);
  assert.equal(history.filter(x=>x.path==="/v1/chat").length,4);
  assert.equal(history.some(x=>x.authorization==="Bearer "+token),true);
  assert.equal(history.some(x=>x.authorization==="Bearer wrong"),true);
  assert.ok(history.every(x=>!x.path.includes("token")));
  assert.doesNotMatch(JSON.stringify(result),new RegExp(token));
});

test("workflow reuses genuine ARM64 model and tests actual owner-host sidecar",()=>{
  const y=readFileSync(new URL("../.github/workflows/hercules-arm64-qwen15-comparison.yml",import.meta.url),"utf8");
  for(const term of [
    "runs-on: ubuntu-24.04-arm",
    "hercules-qwen15-owner-host.mjs",
    "hercules-qwen15-private-live-smoke.mjs",
    "HERCULES_QWEN15_PRIVATE_TRIAL=true",
    "HERCULES_MODEL_TOKEN",
    "127.0.0.1:38900/health",
    "Measure 27 actual replies without public network serving",
    "sha256sum -c -"
  ])assert.ok(y.includes(term),term);
  assert.doesNotMatch(y,/RENDER_API_KEY|SHOPIFY_API_KEY|OPENAI_API_KEY|oci\s+compute\s+instance\s+launch/i);
});
