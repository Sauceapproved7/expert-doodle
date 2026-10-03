import test from "node:test";
import assert from "node:assert/strict";
import {createMissionEngine} from "../hercules-bot/mission-engine.mjs";

test("mission engine creates a read-only plan before execution", async () => {
  const engine=createMissionEngine({executor:async()=>{throw new Error("must not execute");}});
  const plan=await engine.plan("inspect the vault and check the system");
  assert.equal(plan.mode,"plan-only");
  assert.equal(plan.steps.length,2);
  assert.equal(plan.steps[0].verb,"inspect");
});

test("high-impact mission requires approval before execution", async () => {
  let executed=0;
  const engine=createMissionEngine({executor:async()=>{executed++;return {ok:true};}});
  const plan=await engine.plan("deploy production");
  assert.equal(plan.requiresApproval,true);
  const held=await engine.execute(plan);
  assert.equal(held.status,"awaiting-approval");
  assert.equal(executed,0);
});

test("approved mission executes steps in order and records receipts", async () => {
  const seen=[];
  const engine=createMissionEngine({executor:async(step)=>{seen.push(step.verb);return {ok:true};}});
  const plan=await engine.plan("inspect the vault and inspect the system");
  const result=await engine.execute(plan,{ownerApproved:true});
  assert.equal(result.status,"completed");
  assert.deepEqual(seen,["inspect","inspect"]);
  assert.equal(result.receipts.length,2);
});

test("mission fails closed when a step is unrecognized", async () => {
  const engine=createMissionEngine({executor:async()=>({ok:true})});
  const plan=await engine.plan("do something unknown");
  assert.equal(plan.status,"unrecognized");
});
