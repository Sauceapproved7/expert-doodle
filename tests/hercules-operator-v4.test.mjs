import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorConsole} from "../hercules-bot/operator-v4.mjs";

test("console plans a read command without approval", async () => {
  const console=createOperatorConsole({controller:{run:async(input)=>({status:"completed",input})}});
  const plan=await console.plan("inspect vault");
  assert.equal(plan.command.verb,"inspect");
  assert.equal(plan.command.target,"vault");
  assert.equal(plan.requiresApproval,false);
});

test("console plans mutations as approval-required", async () => {
  const console=createOperatorConsole({controller:{run:async(input,ctx)=>({status:"held",input,ctx})}});
  const plan=await console.plan("move body to stand");
  assert.equal(plan.command.verb,"move");
  assert.equal(plan.command.target,"body");
  assert.equal(plan.requiresApproval,true);
});

test("console never executes during planning", async () => {
  let called=false;
  const console=createOperatorConsole({controller:{run:async()=>{called=true;}}});
  await console.plan("deploy production");
  assert.equal(called,false);
});

test("console executes only through the governed controller", async () => {
  let seen=null;
  const console=createOperatorConsole({controller:{run:async(input,ctx)=>{seen={input,ctx};return {status:"completed"};}}});
  const result=await console.execute("inspect vault");
  assert.equal(result.status,"completed");
  assert.equal(seen.input.target,"vault");
});

test("unknown natural-language commands fail closed", async () => {
  const console=createOperatorConsole({controller:{run:async()=>{throw new Error("must not run");}}});
  const plan=await console.plan("do something mysterious");
  assert.equal(plan.status,"unrecognized");
});
