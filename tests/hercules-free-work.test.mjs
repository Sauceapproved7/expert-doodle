import test from "node:test";
import assert from "node:assert/strict";
import {createWorkEngine, createOllamaInfer, routeWorkRequest, WorkError} from "../hercules-runtime/free-work-core.mjs";

const token="a".repeat(48);
const api=(method,path,{body,authorization=token,origin}={})=>new Request("http://127.0.0.1:38881"+path,{
  method,
  headers:{
    ...(authorization===null?{}:{authorization:"Bearer "+authorization}),
    ...(origin?{origin}:{}),
    ...(body!==undefined?{"content-type":"application/json"}:{}),
  },
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),
});
test("task creation validates type, size, and content",()=>{
  const e=createWorkEngine();
  assert.throws(()=>e.createTask({kind:"shell",prompt:"rm -rf /"}),WorkError);
  assert.throws(()=>e.createTask({kind:"plan",prompt:" "}),WorkError);
  assert.throws(()=>e.createTask({kind:"plan",prompt:"x".repeat(8001)}),WorkError);
  assert.throws(()=>e.createTask({kind:"code",prompt:"test",context:"x".repeat(16001)}),WorkError);
});
test("offline planning reports it is a template, not completed work",async()=>{
  const e=createWorkEngine();
  const task=e.createTask({kind:"plan",prompt:"Build a job board"});
  const output=await e.runTask(task.id);
  assert.equal(output.status,"completed");
  assert.equal(output.engine,"offline-template");
  assert.match(output.output,/Build a job board/);
  assert.match(output.output,/not executed/i);
});
test("offline code review identifies high-risk patterns without executing code",async()=>{
  const e=createWorkEngine();
  const task=e.createTask({kind:"review",prompt:"Review this code",context:"eval(userInput);\nAccess-Control-Allow-Origin: *"});
  const output=await e.runTask(task.id);
  assert.equal(output.status,"completed");
  assert.match(output.output,/eval/);
  assert.match(output.output,/wildcard/i);
  assert.match(output.output,/heuristic/i);
});
test("offline research clearly distinguishes a plan from real sources",async()=>{
  const e=createWorkEngine();
  const task=e.createTask({kind:"research",prompt:"Global browser market"});
  const result=await e.runTask(task.id);
  assert.equal(result.engine,"offline-template");
  assert.match(result.output,/no websites? (were|was) visited/i);
});
test("code generation fails closed without a connected model",async()=>{
  const e=createWorkEngine();
  const task=e.createTask({kind:"code",prompt:"Create a secure login flow"});
  await assert.rejects(e.runTask(task.id),e=>e instanceof WorkError&&e.status===503);
  assert.equal(e.getTask(task.id).status,"blocked");
});
test("connected model runs a bounded task and no external tools",async()=>{
  let observed;
  const e=createWorkEngine({infer:async function(request){observed=request;return "Proposed implementation and tests";}});
  const t=e.createTask({kind:"code",prompt:"Implement pagination",context:"Existing route"});
  const result=await e.runTask(t.id);
  assert.equal(result.status,"completed");
  assert.equal(result.engine,"model");
  assert.equal(observed.kind,"code");
  assert.equal(observed.prompt,"Implement pagination");
});
test("task IDs use independent identities and list responses omit context",()=>{
  const e=createWorkEngine();
  const a=e.createTask({kind:"plan",prompt:"First",context:"internal_private"});
  const b=e.createTask({kind:"plan",prompt:"Second"});
  assert.notEqual(a.id,b.id);
  assert.equal(e.listTasks().length,2);
  assert.doesNotMatch(JSON.stringify(e.listTasks()),/internal_private/);
});
test("task storage is bounded",()=>{
  const e=createWorkEngine({maxJobs:1});
  e.createTask({kind:"plan",prompt:"first"});
  assert.throws(()=>e.createTask({kind:"plan",prompt:"second"}),e=>e.status===429);
});
test("all task endpoints require a valid bearer token",async()=>{
  const e=createWorkEngine();
  for(const path of ["/api/tasks","/api/tasks/not-found"]){
    const r=await routeWorkRequest(api("GET",path,{authorization:null}),{engine:e,token});
    assert.equal(r.status,401);
  }
  const r=await routeWorkRequest(api("GET","/api/tasks",{authorization:"wrong"}),{engine:e,token});
  assert.equal(r.status,401);
  assert.equal(r.headers.get("cache-control"),"no-store");
});
test("create-and-run over HTTP API works with bearer authentication",async()=>{
  const e=createWorkEngine();
  const created=await routeWorkRequest(api("POST","/api/tasks",{body:{kind:"plan",prompt:"Build a shop"}}),{engine:e,token});
  assert.equal(created.status,201);
  const {task}=await created.json();
  const run=await routeWorkRequest(api("POST","/api/tasks/"+task.id+"/run",{body:{}}),{engine:e,token});
  assert.equal(run.status,200);
  assert.equal((await run.json()).task.status,"completed");
});
test("cross-origin API requests fail even with correct token",async()=>{
  const e=createWorkEngine();
  const res=await routeWorkRequest(api("POST","/api/tasks",{origin:"https://attacker.example",body:{kind:"plan",prompt:"test"}}),{engine:e,token});
  assert.equal(res.status,403);
  assert.equal(e.listTasks().length,0);
});
test("unbounded payloads are rejected before JSON parsing",async()=>{
  const e=createWorkEngine();
  const response=await routeWorkRequest(api("POST","/api/tasks",{body:{kind:"plan",prompt:"x".repeat(40000)}}),{engine:e,token});
  assert.equal(response.status,413);
});
test("local model adapter forbids remote hosts, embedded credentials and HTTP redirects",async()=>{
  assert.throws(()=>createOllamaInfer({baseUrl:"https://api.openai.com",model:"test"}),WorkError);
  assert.throws(()=>createOllamaInfer({baseUrl:"http://user:password@127.0.0.1:11434",model:"test"}),WorkError);
  let settings;
  const infer=createOllamaInfer({baseUrl:"http://127.0.0.1:11434",model:"local-test",fetchImpl:async(url,init)=>{
    settings={url,init};
    return new Response(JSON.stringify({message:{content:"Local response"}}),{status:200});
  }});
  assert.equal(await infer({kind:"code",prompt:"test",context:""}),"Local response");
  assert.equal(settings.init.redirect,"error");
  assert.equal(new URL(settings.url).hostname,"127.0.0.1");
  assert.doesNotMatch(JSON.stringify(settings.init),/api_key/i);
});
