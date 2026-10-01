import test from "node:test";
import assert from "node:assert/strict";
import { MARKETING_SYSTEMS, buildMarketingMachineState } from "../hercules-forge/marketing-machine/index.mjs";

test("marketing machine registers the locked 16-system sequence", () => {
  assert.equal(MARKETING_SYSTEMS.length, 16);
  assert.equal(MARKETING_SYSTEMS[0].name, "THE MACHINE");
  assert.equal(MARKETING_SYSTEMS.at(-1).name, "THE LAB");
  assert.deepEqual(MARKETING_SYSTEMS.map(x=>x.order), Array.from({length:16},(_,i)=>i+1));
});

test("mutation-capable systems default to approval-gated fail-closed mode", () => {
  const state=buildMarketingMachineState();
  assert.equal(state.mode, "observe");
  assert.equal(state.approvalRequired, true);
  assert.equal(state.shopify.writeEnabled, false);
  assert.equal(state.killSwitch.enabled, true);
});
