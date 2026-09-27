import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {recoveryPlan} from "../supabase/functions/hercules-revenue-rescue/core.ts";

const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");

function caseLead(caseState){
  return {
    id:"lead-1",
    organizationId:"org-1",
    source:"inbound",
    status:"new",
    email:"customer@example.com",
    estimatedValueCents:125000,
    allowedChannels:["email"],
    context:{caseState}
  };
}

test("customer recovery workspace is the primary authenticated journey",()=>{
  assert.match(launch,/data-view="recoveryView"[^>]*>Recovery Desk</);
  assert.match(launch,/class="view active" id="recoveryView"/);
  assert.match(launch,/id="recoveryForm"/);
  assert.match(launch,/id="recoverySummary"/);
  assert.match(launch,/id="recoveryLeads"/);
  assert.match(launch,/fetchFn\("hercules-revenue-rescue"/);
  assert.match(launch,/action:"dashboard"/);
  assert.match(launch,/action:"leads"/);
  assert.match(launch,/action:"ingest"/);
});

test("workspace exposes usable empty error and blocked states",()=>{
  assert.match(launch,/No recovery cases yet/);
  assert.match(launch,/Recovery Desk unavailable/);
  assert.match(launch,/Human review required/);
  assert.match(launch,/Disputed/);
  assert.match(launch,/Active payment promise/);
  assert.match(launch,/Paid\/closed/);
  assert.match(launch,/Do not contact/);
});

test("blocked receivable states never queue external follow-up",()=>{
  for(const state of ["disputed","promise_active","paid","manual_review","unverified_history","do_not_contact"]){
    assert.deepEqual(recoveryPlan(caseLead(state)),[],state);
  }
});

test("contact-ready receivable can produce a permitted follow-up plan",()=>{
  const plan=recoveryPlan(caseLead("contact_ready"),new Date("2026-09-27T10:00:00Z"));
  assert.equal(plan.length,2);
  assert.ok(plan.every(step=>step.channel==="email"));
});
