import test from "node:test";
import assert from "node:assert/strict";
import {createDifferentiatorLayer} from "../hercules-bot/operator-differentiators.mjs";

test("intent lock prevents ambiguous high-impact actions", () => {
  const d=createDifferentiatorLayer();
  const r=d.intentLock({command:"deploy production",confidence:0.62,impact:"high"});
  assert.equal(r.decision,"confirm");
});

test("capability passport exposes provenance and authority for every adapter", () => {
  const d=createDifferentiatorLayer();
  const r=d.capabilityPassport({target:"body",owner:"SauceApproved",version:"1"});
  assert.equal(r.authority,"owner-controlled");
  assert.equal(r.provenance,"tracked");
});

test("recovery twin checkpoints state and restores the last safe state", () => {
  const d=createDifferentiatorLayer();
  d.recoveryTwin.checkpoint({armed:false,emergencyStop:true});
  d.recoveryTwin.checkpoint({armed:true,emergencyStop:false});
  assert.deepEqual(d.recoveryTwin.restoreSafe(),{armed:false,emergencyStop:true});
});
