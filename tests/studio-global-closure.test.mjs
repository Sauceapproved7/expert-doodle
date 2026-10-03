import test from "node:test";
import assert from "node:assert/strict";
import {
  createGlobalStudioClosureManifest,
  evaluateGlobalStudioReadiness
} from "../sauceapproved-studio/global-closure/core.mjs";

const EXPECTED=[
  "production-command",
  "identity-access-zones",
  "talent-rights-consent",
  "content-authenticity",
  "color-mastering",
  "vfx-turnover-conform",
  "localization-accessibility",
  "live-production-streaming",
  "network-bandwidth-control",
  "delivery-packaging-validation",
  "archive-retention-restore",
  "incident-recovery",
  "operational-observability",
  "capacity-thermal-health",
  "production-finance-ledger",
  "release-readiness-room"
];

test("global closure covers the final sixteen cross-lifecycle gaps",()=>{
  const m=createGlobalStudioClosureManifest();
  assert.deepEqual(m.systems.map(x=>x.id),EXPECTED);
  assert.equal(m.implementationOwner,"SauceApproved enterprise LLC");
  assert.equal(m.buildMode,"hercules-owned");
  assert.equal(m.thirdPartyHostedRuntimeAllowed,false);
  assert.equal(m.thirdPartyProductSubstitutionAllowed,false);
  for(const x of m.systems){
    assert.equal(x.herculesOwned,true);
    assert.equal(x.outsidePlatformAllowed,false);
    assert.equal(x.verified,false);
    assert.ok(x.requirements.length>=4);
  }
});

test("global readiness fails closed until every system has current evidence",()=>{
  const m=createGlobalStudioClosureManifest();
  const r=evaluateGlobalStudioReadiness(m,{});
  assert.equal(r.releaseReady,false);
  assert.deepEqual(r.blockedSystemIds,EXPECTED);
});

test("stale evidence cannot open release readiness",()=>{
  const m=createGlobalStudioClosureManifest();
  const evidence=Object.fromEntries(EXPECTED.map(id=>[id,{verified:true,current:true,artifactSha256:"a".repeat(64)}]));
  evidence["content-authenticity"]={verified:true,current:false,artifactSha256:"b".repeat(64)};
  const r=evaluateGlobalStudioReadiness(m,evidence);
  assert.equal(r.releaseReady,false);
  assert.ok(r.blockedSystemIds.includes("content-authenticity"));
});

test("complete current proof can open the final release room",()=>{
  const m=createGlobalStudioClosureManifest();
  const evidence=Object.fromEntries(EXPECTED.map((id,i)=>[id,{verified:true,current:true,artifactSha256:(i%10).toString().repeat(64)}]));
  const r=evaluateGlobalStudioReadiness(m,evidence);
  assert.equal(r.releaseReady,true);
  assert.deepEqual(r.blockedSystemIds,[]);
  assert.equal(r.proofReceipts.length,EXPECTED.length);
});
