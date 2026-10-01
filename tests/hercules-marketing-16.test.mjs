import test from "node:test";
import assert from "node:assert/strict";
import { createMarketing16Manifest, planMarketing16Run, executeMarketing16Module } from "../sauceapproved-studio/marketing-16/core.mjs";

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
  const plan=planMarketing16Run({brandId:"sauceapproved",objective:"grow verified revenue",evidenceIds:["evidence-1"]});
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

test("all canonical modules execute through the bounded adapter",()=>{
  for(let i=1;i<=16;i++){
    const moduleId=`m${String(i).padStart(2,"0")}`;
    const result=executeMarketing16Module({moduleId,evidenceIds:["e1"],brandId:"sauceapproved",objective:"grow",payload:{}});
    assert.equal(result.ok,true,moduleId);
    assert.equal(result.moduleId,moduleId);
    assert.equal(result.publishAllowed,false);
    assert.equal(result.spendAllowed,false);
    assert.equal(result.storefrontMutationAllowed,false);
  }
});

test("execution fails closed without evidence or for unknown modules",()=>{
  assert.throws(()=>executeMarketing16Module({moduleId:"m01",brandId:"sauceapproved",objective:"grow"}),/marketing_evidence_required/);
  const result=executeMarketing16Module({moduleId:"m99",evidenceIds:["e1"],brandId:"sauceapproved",objective:"grow"});
  assert.deepEqual(result,{ok:false,error:"unknown_marketing_module",moduleId:"m99"});
});

test("THE LAB never auto-selects a winner below its minimum sample",()=>{
  const result=executeMarketing16Module({moduleId:"m16",evidenceIds:["e1"],brandId:"sauceapproved",objective:"test",payload:{variants:[{id:"a",conversions:2,sampleSize:5},{id:"b",conversions:3,sampleSize:5}],minSampleSize:20}});
  assert.equal(result.data.status,"insufficient_sample");
  assert.equal(result.data.winner,null);
});
