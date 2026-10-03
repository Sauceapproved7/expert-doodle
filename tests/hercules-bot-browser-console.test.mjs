import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorConsole} from "../hercules-bot/operator-v4.mjs";

test("operator console exposes browser navigation as an approval-gated command",async()=>{
 let executed=null;
 const console=createOperatorConsole({
  controller:{run:async(command,context)=>{executed={command,context};return {status:"completed",command}}}
 });
 const plan=await console.plan("open browser https://example.com");
 assert.equal(plan.status,"planned");
 assert.equal(plan.command.verb,"browser-navigate");
 assert.equal(plan.requiresApproval,true);
 const result=await console.execute("open browser https://example.com",{ownerApproved:true});
 assert.equal(result.status,"completed");
 assert.equal(executed.command.target,"browser");
});
