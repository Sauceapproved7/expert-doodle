import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorSession} from "../hercules-bot/operator-v5.mjs";

test("session turns user speech/text into a plan without executing it", async () => {
  let called=false;
  const session=createOperatorSession({console:{plan:async(text)=>({status:"planned",command:{verb:"inspect",target:"system"},requiresApproval:false}),execute:async()=>{called=true;}}});
  const result=await session.receive("check the system");
  assert.equal(result.mode,"planned");
  assert.equal(result.requiresApproval,false);
  assert.equal(called,false);
});

test("session requires approval before mutating execution", async () => {
  let approvedContext=null;
  const session=createOperatorSession({console:{
    plan:async()=>({status:"planned",command:{verb:"move",target:"body",mutates:true},requiresApproval:true}),
    execute:async(_text,ctx)=>{approvedContext=ctx;return {status:"completed"};}
  }});
  const held=await session.receive("stand up");
  assert.equal(held.mode,"awaiting-approval");
  const done=await session.approve();
  assert.equal(done.status,"completed");
  assert.equal(approvedContext.ownerApproved,true);
});

test("session emergency stop clears pending action", async () => {
  let executed=false;
  const session=createOperatorSession({console:{
    plan:async()=>({status:"planned",command:{verb:"move",target:"body",mutates:true},requiresApproval:true}),
    execute:async()=>{executed=true;return {status:"completed"};}
  }});
  await session.receive("stand up");
  const result=await session.emergencyStop();
  assert.equal(result.status,"stopped");
  assert.equal((await session.approve()).status,"no-pending-command");
  assert.equal(executed,false);
});
