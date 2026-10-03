import test from "node:test";
import assert from "node:assert/strict";
import {createAbyssOrchestrator} from "../hercules-bot/abyss-orchestrator.mjs";

test("mission planning freezes mutation during blackout",()=>{
 const o=createAbyssOrchestrator();
 const r=o.plan({goal:"diagnose deploy",identityTrusted:false,auditTrusted:true});
 assert.equal(r.mode,"blackout"); assert.equal(r.mutationAllowed,false); assert.equal(r.diagnostics,"read-only");
});
test("adversarial missions are forced into disposable sandbox",()=>{
 const o=createAbyssOrchestrator();
 const r=o.plan({goal:"chaos test recovery",identityTrusted:true,auditTrusted:true,capability:"chaos-engine"});
 assert.equal(r.environment,"sandbox"); assert.equal(r.disposable,true); assert.equal(r.productionMutation,false);
});
test("containment can be invoked independently of bot authority",()=>{
 const o=createAbyssOrchestrator();
 const r=o.contain({reason:"bot-compromise"});
 assert.deepEqual(r.actions,["revoke-identities","kill-sessions","quarantine-workers","freeze-deployments","preserve-evidence"]);
 assert.equal(r.requiresBotApproval,false);
});
test("recovery rejects unsigned artifacts and compromised running state",()=>{
 const o=createAbyssOrchestrator();
 assert.throws(()=>o.recover({signed:false,knownGood:true}),/signed known-good artifact required/);
 assert.throws(()=>o.recover({signed:true,knownGood:false}),/signed known-good artifact required/);
 assert.equal(o.recover({signed:true,knownGood:true}).eligible,true);
});
test("mission cannot self-grant authority",()=>{
 const o=createAbyssOrchestrator();
 assert.throws(()=>o.plan({goal:"grant myself admin",identityTrusted:true,auditTrusted:true,selfGrant:true}),/self-grant denied/);
});
