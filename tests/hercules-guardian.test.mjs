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


test("Guardian verdict can be bound into the canonical Hercules Proof Object", async () => {
  const {createGuardianProofObject}=await import("../hercules-guardian/proof-adapter.mjs");
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  const proof=createGuardianProofObject({
    guardianResult:result,
    authorizationEvidenceSha256:"c".repeat(64)
  });
  assert.equal(proof.schema,"hercules.proof.object.v1");
  assert.equal(proof.executionAuthority,false);
  assert.equal(proof.verification.status,"VERIFIED_HEALTHY");
  assert.match(proof.proofSha256,/^[a-f0-9]{64}$/);
});


test("containment gate produces approval-gated lifecycle only for verified drift", async () => {
  const {createGuardianContainmentProposal}=await import("../hercules-guardian/containment-gate.mjs");
  const auth="d".repeat(64);
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"f".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  const proposal=createGuardianContainmentProposal({guardianResult:result,authorizationEvidenceSha256:auth});
  assert.equal(proposal.lifecycle.state,"READY_FOR_AUTHORIZED_EXECUTION");
  assert.equal(proposal.lifecycle.requiresApproval,true);
  assert.equal(proposal.lifecycle.executionAuthority,false);
  assert.equal(proposal.consequence.action.target,"studio-api");
  assert.equal(proposal.recovery.executionAuthority,false);
});

test("containment gate refuses healthy state", async () => {
  const {createGuardianContainmentProposal}=await import("../hercules-guardian/containment-gate.mjs");
  const result=evaluateGuardianState({
    expected:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    observed:{artifact:"sha256:"+"a".repeat(64),config:"sha256:"+"b".repeat(64),identity:"svc-studio",policy:"policy-v1"},
    target:{id:"studio-api",scope:"service"}
  });
  assert.throws(()=>createGuardianContainmentProposal({guardianResult:result,authorizationEvidenceSha256:"d".repeat(64)}),/verified drift required/);
});


test("Render adapter binds deployment metadata without secrets", async () => {
  const {collectRenderServiceEvidence}=await import("../hercules-guardian/render-adapter.mjs");
  const e=collectRenderServiceEvidence({
    id:"srv-studio",name:"sauceapproved-studio",branch:"main",repo:"https://github.com/Sauceapproved7/expert-doodle",
    suspended:"not_suspended",serviceDetails:{runtime:"node",url:"https://sauceapproved-studio.onrender.com"}
  },{artifactSha256:"a".repeat(64),configSha256:"b".repeat(64),policyId:"guardian-studio-v1"});
  assert.equal(e.identity,"render:srv-studio:sauceapproved-studio");
  assert.equal(e.artifact,"sha256:"+"a".repeat(64));
  assert.equal(e.config,"sha256:"+"b".repeat(64));
  assert.equal(e.policy,"guardian-studio-v1");
  assert.equal("sshAddress" in e,false);
});
