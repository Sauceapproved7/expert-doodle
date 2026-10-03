import test from "node:test";
import assert from "node:assert/strict";
import { createMarketing16Manifest, planMarketing16Run } from "../sauceapproved-studio/marketing-16/core.mjs";

const expected=[
  "THE MACHINE","Product Intelligence Engine","Creative Lab","Offer Architect",
  "Ad Economics Calculator","Landing-Page Killer","Retention Engine","Creative Performance Brain",
  "Daily Command Center","BLACKBOX","Shadow Radar","Creative DNA",
  "Profit Sniper","Customer X-Ray","Kill Switch","THE LAB"
];

test("marketing suite exposes the canonical 16 modules in order",()=>{
  const manifest=createMarketing16Manifest();
  assert.equal(manifest.modules.length,16);
  assert.deepEqual(manifest.modules.map(x=>x.name),expected);
  assert.equal(manifest.executionPolicy,"fail-closed");
  assert.equal(manifest.autoPublish,false);
  assert.equal(manifest.autoSpend,false);
});

test("all 16 planned actions require evidence and preserve mutation boundaries",()=>{
  const plan=planMarketing16Run({
    brandId:"sauceapproved",
    objective:"grow verified revenue",
    evidenceIds:["evidence-1"]
  });
  assert.equal(plan.actions.length,16);
  assert.ok(plan.actions.every(x=>x.evidenceRequired===true));
  assert.ok(plan.actions.every(x=>x.publishAllowed===false));
  assert.ok(plan.actions.every(x=>x.spendAllowed===false));
  assert.ok(plan.actions.every(x=>x.storefrontMutationAllowed===false));
  assert.equal(plan.releaseReady,false);
});

test("marketing suite rejects execution planning without evidence",()=>{
  assert.throws(()=>planMarketing16Run({brandId:"sauceapproved",objective:"grow"}),/marketing_evidence_required/);
});
