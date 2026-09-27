import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const offer=JSON.parse(await readFile(new URL("../governance/hercules-founding-pilot-offer-v1.json",import.meta.url),"utf8"));
const landing=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const brief=await readFile(new URL("../docs/launch/HERCULES-FOUNDING-PILOT-OFFER-V1.md",import.meta.url),"utf8");

test("founding pilot is narrow, executable, and tied to live capabilities",()=>{
  assert.equal(offer.schema,"sauceapproved.hercules.founding-pilot-offer");
  assert.equal(offer.version,1);
  assert.equal(offer.product,"Hercules Revenue Recovery");
  assert.equal(offer.market,"US_B2B_OWN_RECEIVABLES");
  assert.equal(offer.successEvent,"first_verified_useful_action");
  assert.ok(offer.deliverables.includes("recovery_desk_workspace"));
  assert.ok(offer.deliverables.includes("case_state_routing"));
  assert.ok(offer.deliverables.includes("verified_action_history"));
  assert.deepEqual(offer.requiredLiveCapabilities.sort(),["hercules-launch","hercules-revenue-rescue"].sort());
});

test("offer preserves commercial and safety boundaries",()=>{
  assert.equal(offer.pricing.status,"owner_approval_required");
  assert.equal(offer.pricing.postPilotProposal.monthlyUsd,99);
  assert.equal(offer.pricing.activeBilling,false);
  assert.equal(offer.dataHandling.defaultMode,"synthetic_until_authorized");
  assert.equal(offer.externalActions,"approval_gated");
  for(const excluded of ["consumer_debt_collection","third_party_debt_collection","credit_scoring","legal_collections","guaranteed_recovery"]){
    assert.ok(offer.exclusions.includes(excluded),excluded);
  }
});

test("public pilot surface explains who it is for and what the pilot delivers without presenting unapproved pricing as active",()=>{
  assert.match(landing,/Founding Revenue Recovery Pilot/);
  assert.match(landing,/First verified useful action/);
  assert.match(landing,/Recovery Desk/);
  assert.match(landing,/Synthetic until authorized/);
  assert.match(landing,/Commercial terms remain owner-gated/);
  assert.doesNotMatch(landing,/\$99\/month[^\n]*active/i);
});

test("canonical offer brief contains executable intake-to-delivery flow",()=>{
  assert.match(brief,/Pilot intake/);
  assert.match(brief,/Qualification/);
  assert.match(brief,/Workspace activation/);
  assert.match(brief,/First receivable/);
  assert.match(brief,/Verified useful action/);
  assert.match(brief,/Pilot readout/);
  assert.match(brief,/Conversion decision/);
});
