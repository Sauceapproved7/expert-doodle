import test from "node:test";
import assert from "node:assert/strict";
import {createAbyssPolicy} from "../hercules-bot/abyss-policy.mjs";

test("owner authority remains above every Evil Bot capability",()=>{
 const p=createAbyssPolicy();
 assert.equal(p.name,"Evil Bot Abyss Stack");
 assert.equal(p.botName,"Evil Bot");
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
test("policy objects and nested capabilities are immutable",()=>{
 const p=createAbyssPolicy();
 assert.throws(()=>p.capabilities.push({id:"admin",selfGrant:true}),TypeError);
 assert.throws(()=>p.mutiny.controls.push("disable-audit"),TypeError);
 assert.throws(()=>{p.capabilities[0].selfGrant=true},TypeError);
 assert.throws(()=>{p.recovery.requireSignedArtifact=false},TypeError);
});
