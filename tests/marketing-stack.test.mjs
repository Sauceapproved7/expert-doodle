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
