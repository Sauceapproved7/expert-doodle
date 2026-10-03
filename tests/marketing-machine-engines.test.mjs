import test from "node:test";
import assert from "node:assert/strict";
import { calculateEconomics, evaluateGuardrails, buildCommandCenter } from "../hercules-forge/marketing-machine/engines.mjs";

test("economics calculates contribution and break-even ROAS",()=>{const x=calculateEconomics({price:100,cogs:35,fees:5,shipping:10});assert.equal(x.contributionMargin,50);assert.equal(x.breakEvenRoas,2)});
test("kill switch fails closed on missing or breached limits",()=>{assert.equal(evaluateGuardrails({}).allow,false);assert.equal(evaluateGuardrails({spend:120,maxSpend:100,sampleSize:100,minSampleSize:50}).allow,false);assert.equal(evaluateGuardrails({spend:80,maxSpend:100,sampleSize:100,minSampleSize:50}).allow,true)});
test("command center returns all 16 systems",()=>{assert.equal(buildCommandCenter().systems.length,16)});
