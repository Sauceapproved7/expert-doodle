import test from "node:test";
import assert from "node:assert/strict";
import {createOperatorAdapterRegistry, createHardwareBodyInterface} from "../hercules-bot/operator-v3.mjs";

test("registry exposes only explicitly registered capabilities", async () => {
  const registry=createOperatorAdapterRegistry({forge:{inspect:async()=>({ok:true})}});
  assert.deepEqual(registry.capabilities(),[{target:"forge",verbs:["inspect"]}]);
  assert.equal((await registry.adapters.forge.inspect()).ok,true);
});

test("hardware body interface defaults disconnected and emergency-stopped", async () => {
  const body=createHardwareBodyInterface();
  assert.deepEqual(await body.status(),{
    hardwareConnected:false,
    emergencyStop:true,
    armed:false,
    motorsCommanded:false
  });
});

test("hardware body interface cannot arm without a reviewed transport", async () => {
  const body=createHardwareBodyInterface();
  const result=await body.arm({ownerApproved:true});
  assert.equal(result.armed,false);
  assert.equal(result.reason,"hardware-transport-not-configured");
});

test("disconnect forces emergency stop before future motion", async () => {
  const body=createHardwareBodyInterface({transport:{send:async()=>({ok:true}),reviewed:true}});
  assert.equal((await body.arm({ownerApproved:true})).armed,true);
  await body.disconnect();
  const state=await body.status();
  assert.equal(state.emergencyStop,true);
  assert.equal(state.armed,false);
});
