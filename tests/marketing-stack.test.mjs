import test from "node:test";
import assert from "node:assert/strict";
import {MARKETING_MODULES, getMarketingModule, buildMarketingRun} from "../lib/hercules/marketing-stack.js";

test("marketing stack contains the canonical 16 modules in order",()=>{
  assert.equal(MARKETING_MODULES.length,16);
  assert.deepEqual(MARKETING_MODULES.map(x=>x.name),[
    "THE MACHINE","Product Intelligence Engine","Creative Lab","Offer Architect",
    "Ad Economics Calculator","Landing-Page Killer","Retention Engine",
    "Creative Performance Brain","Daily Command Center","BLACKBOX","Shadow Radar",
    "Creative DNA","Profit Sniper","Customer X-Ray","Kill Switch","THE LAB"
  ]);
});
test("module lookup is deterministic",()=>{
  assert.equal(getMarketingModule("profit-sniper").name,"Profit Sniper");
  assert.equal(getMarketingModule("missing"),null);
});
test("run plan is fail-closed and preserves canonical order",()=>{
  const p=buildMarketingRun({goal:"grow qualified traffic"});
  assert.equal(p.state,"prepared");
  assert.equal(p.executionAuthorized,false);
  assert.equal(p.steps.length,16);
  assert.equal(p.steps[0].moduleId,"the-machine");
  assert.equal(p.steps[15].moduleId,"the-lab");
});

test("contracts are non-mutating by default",async()=>{
 const {moduleContract}=await import("../lib/hercules/marketing-stack.js");
 assert.equal(moduleContract("creative-lab").mutates,false);
 assert.throws(()=>moduleContract("nope"),/unknown_module/);
});
test("kill switch overrides execution approval",async()=>{
 const {authorizeMarketingRun}=await import("../lib/hercules/marketing-stack.js");
 const p=buildMarketingRun({goal:"launch"});
 assert.equal(authorizeMarketingRun(p,{approved:true}).executionAuthorized,true);
 const blocked=authorizeMarketingRun(p,{approved:true,killSwitch:true});
 assert.equal(blocked.executionAuthorized,false);
 assert.equal(blocked.state,"blocked");
});
