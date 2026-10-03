import test from "node:test";
import assert from "node:assert/strict";
import { createPrototypePlan, evaluatePrototypeGate } from "../hercules-forge/rapid-prototype.mjs";

test("creates a bounded Hercules-owned prototype plan", () => {
  const plan = createPrototypePlan({ goal: "Build a CHIP-8 learning emulator", targetFps: 60 });
  assert.equal(plan.owner, "SauceApproved enterprise LLC");
  assert.equal(plan.targetFps, 60);
  assert.equal(plan.productionReady, false);
  assert.deepEqual(plan.requiredGates, ["tests", "security", "provenance", "owner-approval"]);
});

test("production gate fails closed until every required check passes", () => {
  assert.equal(evaluatePrototypeGate({ tests: true, security: true, provenance: true, ownerApproval: false }).allowed, false);
  assert.equal(evaluatePrototypeGate({ tests: true, security: true, provenance: true, ownerApproval: true }).allowed, true);
});

test("rejects unsafe or malformed prototype inputs", () => {
  assert.throws(() => createPrototypePlan({ goal: "", targetFps: 60 }), /goal/i);
  assert.throws(() => createPrototypePlan({ goal: "demo", targetFps: 0 }), /targetFps/i);
});
