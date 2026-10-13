import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';

const source=await readFile(new URL('../render/hercules-browser-standalone/server.mjs',import.meta.url),'utf8');
// Exercise the production session functions with a context factory instead of Chromium.
const sessionFunctions=source.slice(source.indexOf('async function freshSession('),source.indexOf('async function pageState('));
const workerFunction=source.slice(source.indexOf('async function workerSession('),source.indexOf('async function canonicalWorkerRun('));

function runtime(){
  const contexts=[];
  const browser={async newContext(){
    const context={closed:false,async newPage(){return {async route(){}};},async close(){this.closed=true;}};
    contexts.push(context);return context;
  }};
  const context=vm.createContext({crypto:{randomUUID},Date,MAX_BROWSER_CONTEXTS:1,VIEWPORT:{width:1280,height:800},networkAllowed:async()=>true,browser:async()=>browser});
  new vm.Script(`const sessions=new Map();let ownerSessionId=null;let ownerSessionPromise=null;let sessionCreations=0;${sessionFunctions}\n${workerFunction}\nthis.getOwner=ownerSession;this.getWorker=workerSession;this.liveCount=()=>sessions.size;this.finishWorker=id=>{sessions.get(id).activeRequests=0;};`).runInContext(context);
  return {context,contexts};
}

test('parallel owner requests share one Chromium context',async()=>{
  const {context,contexts}=runtime();
  const [first,second]=await Promise.all([context.getOwner(),context.getOwner()]);
  assert.equal(first.id,second.id);
  assert.equal(contexts.length,1,'status and frame requests must not allocate duplicate contexts');
});

test('new workers cannot allocate another context alongside the owner page',async()=>{
  const {context,contexts}=runtime();
  const owner=await context.getOwner();
  await assert.rejects(context.getWorker(null,true),/browser_capacity_busy/);
  assert.equal(contexts.length,1);
  assert.equal(owner.context.closed,false,'the live owner page must be preserved');
});

test('opening the owner retires an unused worker instead of accumulating contexts',async()=>{
  const {context}=runtime();
  const worker=await context.getWorker(null,true);
  context.finishWorker(worker.id);
  const owner=await context.getOwner();
  assert.notEqual(owner.id,worker.id);
  assert.equal(worker.context.closed,true);
  assert.equal(context.liveCount(),1);
});

test('expired worker IDs fail explicitly instead of silently opening a blank context',async()=>{
  const {context,contexts}=runtime();
  await assert.rejects(context.getWorker('expired-session',true),/session_expired/);
  assert.equal(contexts.length,0);
});

test('transient workers remain counted while their request is active',async()=>{
  const {context}=runtime();
  const worker=await context.getWorker(null,false);
  assert.equal(context.liveCount(),1);
  assert.equal(worker.persist,false);
});

test('opening the owner cannot evict a worker in the middle of its request',async()=>{
  const {context}=runtime();
  const worker=await context.getWorker(null,true);
  await assert.rejects(context.getOwner(),/browser_capacity_busy/);
  assert.equal(worker.context.closed,false);
});
