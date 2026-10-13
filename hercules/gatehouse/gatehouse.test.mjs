import test from "node:test";
import assert from "node:assert/strict";
import {
  assessLaunch, sentinelAlerts, revenueRadar, recoveryPlan, simulateCheckout,
  newEvidenceLedger, appendEvidence, verifyEvidenceLedger, timeMachine,
  validateTarget
} from "./core.mjs";

const NOW="2026-10-13T12:00:00.000Z";

test("no connected evidence fails closed, never authorizes a launch",()=>{
  const state=assessLaunch({},NOW);
  assert.equal(state.ready,false);
  assert.equal(state.productionAuthorized,false);
  assert.equal(state.policyReady,false);
  assert.equal(state.gates.missing.length,9);
});
test("nine self-reported passing gates still cannot open launch",()=>{
  const all=Object.fromEntries([
    "spaceship_authorized","dns_verified","shopify_domain_ssl_verified",
    "inventory_verified","payment_provider_live_verified","payout_destination_verified",
    "paid_checkout_verified","refund_verified","owner_launch_approval"
  ].map(key=>[key,{verified:true,verifiedAt:NOW,source:key==="owner_launch_approval"?"owner-signed-approval":"trusted-provider-check",domain:"sauceapproved.com",environment:"production"}]));
  const result=assessLaunch(all,NOW);
  assert.equal(result.gates.policyReady,true);
  assert.equal(result.productionAuthorized,false);
  assert.equal(result.ready,false);
});
test("Sentinel labels missing, stale and unreachable signals correctly",()=>{
  const alerts=sentinelAlerts([
    {name:"Shopify",status:"unknown"},
    {name:"Render",status:"unreachable"},
    {name:"GitHub",status:"healthy",checkedAt:"2026-10-10T00:00:00Z"}
  ],NOW);
  assert.ok(alerts.some(x=>x.service==="Shopify"&&x.level==="unknown"));
  assert.ok(alerts.some(x=>x.service==="Render"&&x.level==="critical"));
  assert.ok(alerts.some(x=>x.service==="GitHub"&&x.level==="stale"));
});
test("Revenue Radar does not mistake absence of receipts for zero revenue",()=>{
  const r=revenueRadar();
  assert.equal(r.verifiedGrossCents,null);
  assert.equal(r.verifiedPayoutsCents,null);
  assert.equal(r.authoritative,false);
});
test("Revenue Radar prevents untrusted order records from becoming verified cash",()=>{
  const r=revenueRadar([{id:"demo-123",status:"paid",totalCents:4900,source:"manual",synthetic:true}]);
  assert.equal(r.verifiedGrossCents,null);
  assert.equal(r.reportedGrossCents,0);
  assert.equal(r.authoritative,false);
});
test("Recovery cannot issue production actions or alter a real gate",()=>{
  const plan=recoveryPlan([{service:"Render",level:"critical",message:"unreachable"}]);
  assert.ok(plan.actions.every(x=>x.scope==="local-only" && x.requiresProductionAuthorization===false));
  assert.equal(plan.canModifyProduction,false);
});
test("Synthetic simulator never creates a payment or authorizes production",()=>{
  const ok=simulateCheckout({scenario:"success"});
  const bad=simulateCheckout({scenario:"payment-declined"});
  assert.equal(ok.synthetic,true);
  assert.equal(ok.productionAuthorized,false);
  assert.equal(ok.steps.at(-1).result,"pass");
  assert.equal(bad.steps.at(-1).result,"blocked");
});
test("Evidence Vault creates a chain that detects editing",()=>{
  const first=appendEvidence(newEvidenceLedger(),{kind:"probe",service:"DNS",state:"unknown",at:NOW});
  const second=appendEvidence(first,{kind:"probe",service:"Render",state:"healthy",at:NOW});
  assert.equal(verifyEvidenceLedger(second).ok,true);
  const edited=structuredClone(second);
  edited[0].record.service="Stripe";
  assert.equal(verifyEvidenceLedger(edited).ok,false);
});
test("Time Machine diffs snapshots without ever claiming rollback occurred",()=>{
  const result=timeMachine([
    {at:"2026-10-12T12:00:00Z",signals:[{name:"DNS",status:"unknown"}]},
    {at:NOW,signals:[{name:"DNS",status:"healthy"}]}
  ]);
  assert.deepEqual(result.changes.map(x=>x.service),["DNS"]);
  assert.equal(result.liveRollbackPerformed,false);
});
test("read-only probes reject internal URLs, dangerous schemes and credentials",()=>{
  assert.throws(()=>validateTarget("http://127.0.0.1/health"));
  assert.throws(()=>validateTarget("https://example.com@127.0.0.1/"));
  assert.throws(()=>validateTarget("https://169.254.169.254/"));
  assert.equal(validateTarget("https://hercules-mcp.onrender.com/health").hostname,"hercules-mcp.onrender.com");
});
