import test from "node:test";
import assert from "node:assert/strict";
import {createAbyssPolicy} from "../hercules-bot/abyss-policy.mjs";

test("owner authority remains above every Smallz capability",()=>{
 const p=createAbyssPolicy();
 for(const c of p.capabilities) assert.equal(c.selfGrant,false);
 assert.equal(p.ownerSovereignty,true); assert.equal(p.emergencyStopExternal,true);
});
test("hostile testing is sandbox-only and production mutation fails closed",()=>{
 const p=createAbyssPolicy();
 for(const id of ["red-team","adversarial-twin","chaos-engine","betrayal-tests","nightmare-tests","deception-lab"])
  assert.equal(p.capabilities.find(x=>x.id===id).environment,"sandbox");
 assert.equal(p.productionAdversarialMutation,false);
});
test("blackout freezes mutation when authority or audit integrity is uncertain",()=>{
 const p=createAbyssPolicy();
 assert.equal(p.blackout({identityTrusted:false,auditTrusted:true}).mutation,"deny");
 assert.equal(p.blackout({identityTrusted:true,auditTrusted:false}).mutation,"deny");
 assert.equal(p.blackout({identityTrusted:true,auditTrusted:true}).mutation,"policy");
});
test("bot compromise can be contained outside bot authority",()=>{
 const p=createAbyssPolicy();
 assert.deepEqual(p.mutiny.controls,["revoke-identities","kill-sessions","quarantine-workers","freeze-deployments","preserve-evidence"]);
 assert.equal(p.mutiny.botCanOverride,false);
});
test("recovery requires signed known-good state",()=>{
 const p=createAbyssPolicy();
 assert.equal(p.recovery.requireSignedArtifact,true);
 assert.equal(p.recovery.trustRunningCompromisedState,false);
});
