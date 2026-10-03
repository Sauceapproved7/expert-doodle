import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorController} from "../hercules-bot/operator-controller.mjs";

test("controller executes an allowed read adapter and returns evidence", async () => {
  const controller=createOperatorController({adapters:{vault:{inspect:async()=>({ok:true,items:3})}}});
  const result=await controller.run({verb:"inspect",target:"vault",mutates:false});
  assert.equal(result.status,"completed");
  assert.deepEqual(result.evidence,{ok:true,items:3});
  assert.equal(result.receipt.authorization.decision,"allow");
});

test("controller holds a body mutation without owner approval", async () => {
  let moved=false;
  const controller=createOperatorController({adapters:{body:{move:async()=>{moved=true;}}}});
  const result=await controller.run({verb:"move",target:"body",mutates:true});
  assert.equal(result.status,"held");
  assert.equal(moved,false);
});

test("controller permits approved body commands only through a registered adapter", async () => {
  const controller=createOperatorController({adapters:{body:{move:async(input)=>({simulated:true,pose:input.payload.pose})}}});
  const result=await controller.run({verb:"move",target:"body",mutates:true,payload:{pose:"stand"}},{ownerApproved:true});
  assert.equal(result.status,"completed");
  assert.deepEqual(result.evidence,{simulated:true,pose:"stand"});
});

test("controller fails closed for unregistered capabilities", async () => {
  const controller=createOperatorController({adapters:{}});
  const result=await controller.run({verb:"deploy",target:"production",mutates:true},{ownerApproved:true});
  assert.equal(result.status,"denied");
  assert.equal(result.reason,"adapter-not-registered");
});

test("kill switch prevents adapter execution", async () => {
  let called=false;
  const controller=createOperatorController({adapters:{vault:{inspect:async()=>{called=true;}}}});
  const result=await controller.run({verb:"inspect",target:"vault"},{killSwitch:true});
  assert.equal(result.status,"denied");
  assert.equal(called,false);
});
