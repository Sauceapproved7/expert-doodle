import test from "node:test";
import assert from "node:assert/strict";
import {once} from "node:events";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createServer as createCandidateBridge} from "../hercules-models/experimental-chat-bridge.mjs";

const TOKEN="owner-test-token-"+"a".repeat(40);
const MODEL="hercules-core-neural-v03-experimental";
async function runServer(generator=async()=>({continuation:"A short experimental continuation."})){
  const server=createCandidateBridge({token:TOKEN,modelId:MODEL,generate:generator});
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const base="http://127.0.0.1:"+server.address().port;
  return {server,base,close:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))};
}
const auth={Authorization:"Bearer "+TOKEN};
const sample=(overrides={})=>({model:MODEL,messages:[{role:"user",content:"Test one sentence."}],stream:false,...overrides});
async function post(base,data,headers=auth){
  const response=await fetch(base+"/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(data)});
  return {response,body:await response.text()};
}

test("public health discloses experimental/non-release status without secrets",async()=>{
  const run=await runServer();
  try{
    const response=await fetch(run.base+"/health");
    const result=await response.json();
    assert.equal(response.status,200);
    assert.equal(result.service,"hercules-experimental-chat-bridge");
    assert.equal(result.experimental,true);
    assert.equal(result.public_release_approved,false);
    assert.equal(result.chat_quality_verified,false);
    assert.equal(response.headers.get("cache-control"),"no-store");
    assert.doesNotMatch(JSON.stringify(result),/owner-test-token/);
  }finally{await run.close()}
});

test("all model inventory and chat routes require the exact bearer token",async()=>{
  const run=await runServer();
  try{
    for(const url of ["/api/tags","/v1/chat/completions"]){
      const bad=await fetch(run.base+url,url.includes("chat")?{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(sample())}:{});
      assert.equal(bad.status,401,url);
      const withWrong=await fetch(run.base+url,{method:url.includes("chat")?"POST":"GET",headers:{...auth,Authorization:"Bearer wrong"}});
      assert.equal(withWrong.status,401,url);
    }
  }finally{await run.close()}
});

test("Ollama-like inventory is explicit experimental ID and not default qwen",async()=>{
  const run=await runServer();
  try{
    const response=await fetch(run.base+"/api/tags",{headers:auth});
    const d=await response.json();
    assert.equal(response.status,200);
    assert.deepEqual(d.models.map(m=>m.name),[MODEL]);
    assert.equal(d.models[0].details.family,"hercules-native-experimental");
    assert.doesNotMatch(JSON.stringify(d),/qwen2.5:7b/);
  }finally{await run.close()}
});

test("authorized non-streaming request returns only real candidate result in chat schema",async()=>{
  let calls=0;
  const run=await runServer(async(prompt,options)=>{calls++;assert.equal(prompt,"Test one sentence.");assert.ok(options.maxTokens<=48);return {continuation:"Native output."}});
  try{
    const {response,body}=await post(run.base,sample({max_tokens:30}));
    assert.equal(response.status,200);
    const d=JSON.parse(body);
    assert.equal(d.model,MODEL);
    assert.equal(d.choices[0].message.role,"assistant");
    assert.equal(d.choices[0].message.content,"Native output.");
    assert.equal(d.experimental,true);
    assert.equal(calls,1);
  }finally{await run.close()}
});

test("streaming returns bounded SSE delta and DONE, not a mocked public chat",async()=>{
  const run=await runServer(async()=>({continuation:"Lab-only text."}));
  try{
    const {response,body}=await post(run.base,sample({stream:true}));
    assert.equal(response.status,200);
    assert.match(response.headers.get("content-type"),/text\/event-stream/);
    assert.match(body,/data: .*"content":"Lab-only text\."/);
    assert.match(body,/data: \[DONE\]/);
  }finally{await run.close()}
});

test("wrong model and invalid messages are rejected without calling candidate",async()=>{
  let n=0;const run=await runServer(async()=>{n++;return {continuation:"should-not-run"}});
  try{
    for(const invalid of [sample({model:"qwen2.5:7b"}),sample({messages:[]}),sample({messages:[{role:"system",content:"no user"}]}),sample({messages:[{role:"user",content:""}]}),sample({messages:[{role:"user",content:"x".repeat(2200)}]})]){
      const {response}=await post(run.base,invalid);
      assert.ok(response.status===400||response.status===422);
    }
    assert.equal(n,0);
  }finally{await run.close()}
});

test("empty generation and thrown engine errors fail closed without leaking internals",async()=>{
  for(const gen of [async()=>({continuation:"  "}),async()=>{throw Error("secret-access-token-should-never-leak")} ]){
    const run=await runServer(gen);
    try{
      const {response,body}=await post(run.base,sample());
      assert.equal(response.status,503);
      assert.doesNotMatch(body,/secret-access-token|stack|internal-host/);
      assert.doesNotMatch(body,/A short experimental continuation/);
    }finally{await run.close()}
  }
});

test("oversize POST fails without running generation or retaining request",async()=>{
  let calls=0;const run=await runServer(async()=>{calls++;return {continuation:"unexpected"}});
  try{
    const response=await fetch(run.base+"/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",...auth},body:JSON.stringify({model:MODEL,messages:[{role:"user",content:"z".repeat(28000)}]})});
    assert.equal(response.status,413);
    assert.equal(calls,0);
  }finally{await run.close()}
});

test("no unapproved methods/paths and invalid token configuration fail closed",async()=>{
  assert.throws(()=>createCandidateBridge({token:"short",modelId:MODEL,generate:async()=>({continuation:"a"})}),/token/i);
  const run=await runServer();
  try{
    for(const [path,method] of [["/v1/models","GET"],["/api/pull","POST"],["/v1/chat/completions","GET"]]){
      const r=await fetch(run.base+path,{method,headers:auth});
      assert.equal(r.status,404);
    }
  }finally{await run.close()}
});

test("experiment CLI refuses to bind unless explicitly enabled",()=>{
  const cli=fileURLToPath(new URL("../hercules-models/experimental-chat-cli.mjs",import.meta.url));
  const run=spawnSync(process.execPath,[cli],{
    env:{...process.env,HERCULES_EXP_CHAT_EXPERIMENT_ENABLED:"false",HERCULES_EXP_CHAT_HOST:"127.0.0.1"},
    encoding:"utf8",timeout:12000
  });
  assert.notEqual(run.status,0);
  assert.match(run.stderr,/experimental bridge disabled/i);
  assert.doesNotMatch(run.stdout,/owner-test-token|service.*chat-bridge/);
});
