import test from "node:test";
import assert from "node:assert/strict";
import {createBodyTransport,createVoiceBridge,createOwnerDashboard} from "../hercules-bot/operator-v7.mjs";

test("body transport is disconnected and E-stopped by default",async()=>{
 const b=createBodyTransport();
 assert.deepEqual(await b.status(),{connected:false,armed:false,emergencyStop:true});
 assert.equal((await b.connect()).connected,false);
});
test("voice bridge is input/output adapter only",async()=>{
 const v=createVoiceBridge({transcribe:async()=> "inspect vault",speak:async()=>({ok:true})});
 assert.equal(await v.listen(), "inspect vault");
 assert.deepEqual(await v.say("ready"),{ok:true});
});
test("dashboard reports state and pending approval without executing",async()=>{
 const d=createOwnerDashboard({body:{status:async()=>({connected:false,armed:false,emergencyStop:true})},session:{pending:()=>({command:"move body"})}});
 const s=await d.snapshot();
 assert.equal(s.body.emergencyStop,true);
 assert.equal(s.pending.command,"move body");
});
