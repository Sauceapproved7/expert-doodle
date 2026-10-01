import test from "node:test";
import assert from "node:assert/strict";
import {evaluateGuardianState} from "../hercules-guardian/guardian.mjs";

test("healthy state produces an allow verdict with no containment", () => {
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.verdict,"allow");
  assert.equal(result.containment.required,false);
  assert.deepEqual(result.drift,[]);
  assert.match(result.proof.id,/^guardian-proof-/);
});

test("artifact drift fails closed and scopes containment to the affected target", () => {
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:evil",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.verdict,"deny");
  assert.equal(result.containment.required,true);
  assert.equal(result.containment.target,"studio-api");
  assert.equal(result.containment.scope,"service");
  assert.deepEqual(result.drift.map(x=>x.field),["artifact"]);
  assert.equal(result.recovery.required,true);
});

test("missing evidence is drift rather than implicit trust", () => {
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:aaa",config:"sha256:bbb",identity:"svc-studio"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.equal(result.verdict,"deny");
  assert.equal(result.drift[0].field,"policy");
  assert.equal(result.drift[0].reason,"missing_observation");
});


test("collector converts runtime evidence into the canonical Guardian dimensions", async () => {
  const {collectGuardianEvidence}=await import("../hercules-guardian/collector.mjs");
  const evidence=collectGuardianEvidence({
    artifact:{sha256:"a".repeat(64)},
    config:{sha256:"b".repeat(64)},
    workload:{identity:"svc-studio"},
    policy:{id:"policy-v1"}
  });
  assert.deepEqual(evidence,{
    artifact:"sha256:"+"a".repeat(64),
    config:"sha256:"+"b".repeat(64),
    identity:"svc-studio",
    policy:"policy-v1"
  });
});

test("collector fails closed when a required runtime evidence source is absent", async () => {
  const {collectGuardianEvidence}=await import("../hercules-guardian/collector.mjs");
  assert.throws(()=>collectGuardianEvidence({
    artifact:{sha256:"a".repeat(64)},
    config:{sha256:"b".repeat(64)},
    workload:{identity:"svc-studio"}
  }),/policy evidence is required/);
});
