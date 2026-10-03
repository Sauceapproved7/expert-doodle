import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorSession} from "../hercules-bot/operator-v5.mjs";

test("emergency stop blocks mutations while leaving diagnostics read-only",async()=>{
  const console={
    plan(input){return {status:"planned",command:{input},requiresApproval:input!="inspect vault"}},
    async execute(input,context){return {input,context}}
  };
  const session=createOperatorSession({console});
  await session.receive("move body to stand");
  await session.emergencyStop();
  assert.deepEqual(await session.receive("inspect vault"),{mode:"planned",command:{input:"inspect vault"}});
  assert.deepEqual(await session.receive("move body to stand"),{mode:"stopped",reason:"emergency-stop-active"});
  assert.deepEqual(await session.approve(),{status:"stopped",reason:"emergency-stop-active"});
});
