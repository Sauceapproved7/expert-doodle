import test from "node:test";
import assert from "node:assert/strict";
import {evaluateReleaseGate} from "../scripts/hercules-release-gate.mjs";

function greenEvidence(){
  return {
    build:{ownerCode:true,provenance:true,workflowSyntax:true,tests:true},
    security:{securityBaseline:true,codeql:true,authHardening:true},
    deployment:{signedRelease:true,verifiedDeployment:true,criticalHealth:true,noOpenCriticalIncidents:true},
    rollback:{rollbackReady:true},
    smoke:{storefrontSmoke:true,checkoutSmoke:true,finalCustomerSmoke:true},
    domain:{customDomainComplete:true},
    commercial:{pricing:true,terms:true,privacy:true},
    release:{ownerPublicReleaseApproval:true}
  };
}

test("release gate passes only when every required phase is verified",()=>{
  const result=evaluateReleaseGate(greenEvidence());
  assert.equal(result.ok,true);
  assert.equal(result.eligibleForPublicRelease,true);
  assert.deepEqual(result.blockers,[]);
});

test("release gate fails closed when required evidence is missing",()=>{
  const evidence=greenEvidence();
  delete evidence.security.authHardening;
  const result=evaluateReleaseGate(evidence);
  assert.equal(result.ok,false);
  assert.match(result.blockers.join("\n"),/security\.authHardening/);
});

test("owner public-release approval remains an independent final gate",()=>{
  const evidence=greenEvidence();
  evidence.release.ownerPublicReleaseApproval=false;
  const result=evaluateReleaseGate(evidence);
  assert.equal(result.ok,false);
  assert.equal(result.eligibleForPublicRelease,false);
  assert.match(result.blockers.join("\n"),/release\.ownerPublicReleaseApproval/);
});

test("domain, rollback, and final smoke cannot be skipped",()=>{
  for(const path of [
    ["domain","customDomainComplete"],
    ["rollback","rollbackReady"],
    ["smoke","finalCustomerSmoke"]
  ]){
    const evidence=greenEvidence();
    evidence[path[0]][path[1]]=false;
    const result=evaluateReleaseGate(evidence);
    assert.equal(result.ok,false);
    assert.match(result.blockers.join("\n"),new RegExp(path.join("\\.")));
  }
});
