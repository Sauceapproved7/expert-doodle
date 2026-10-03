import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorConsole} from "../hercules-bot/operator-v4.mjs";

test("operator console plans deploy status without approval",async()=>{
 const console=createOperatorConsole({controller:{run:async()=>({status:"completed"})}});
 const plan=await console.plan("deployment status dep-123");
 assert.equal(plan.command.verb,"deploy-status");
 assert.equal(plan.command.target,"deployer");
 assert.equal(plan.requiresApproval,false);
});

test("operator console gates release deployment behind owner approval",async()=>{
 const console=createOperatorConsole({controller:{run:async()=>({status:"completed"})}});
 const plan=await console.plan("deploy release rel-1 commit abc artifact sha256:123 target hercules_bot_local bot");
 assert.equal(plan.command.verb,"deploy-release");
 assert.equal(plan.requiresApproval,true);
 assert.equal(plan.command.payload.releaseId,"rel-1");
});
