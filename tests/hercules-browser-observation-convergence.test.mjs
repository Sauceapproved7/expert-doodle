import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(
  new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),
  "utf8"
);

test("browser agent exposes navigation-observation convergence version",()=>{
  assert.match(agent,/version:"0\.8\.0"/);
  assert.match(agent,/observationOnlyGoal/);
  assert.match(agent,/navigate_observation/);
});

test("read-only convergence is disabled when named input values exist",()=>{
  assert.match(agent,/if\(inputKeys\.length>0\)return false/);
});

test("read-only convergence requires observational intent",()=>{
  assert.match(agent,/verify\|check\|determine\|identify\|inspect\|return\|report\|whether\|visible\|reachable\|describe\|read\|find/);
  assert.match(agent,/statefulImperative/);
  assert.match(agent,/explicitReadOnly/);
});

test("navigation evidence is evaluated before separate scrape",()=>{
  const nav=agent.indexOf('const nav=await browserCall({action:"navigate"');
  const observed=agent.indexOf('if(observationOnlyGoal(goal,inputKeys))');
  const scrape=agent.indexOf('scrape=await browserCall({',observed);
  assert.ok(nav>=0 && observed>nav && scrape>observed);
});

test("navigation convergence never executes a planner click/type decision",()=>{
  const start=agent.indexOf('if(observationOnlyGoal(goal,inputKeys))');
  const end=agent.indexOf('for(let i=0;i<maxSteps;i++){',start);
  const block=agent.slice(start,end);
  assert.match(block,/if\(observedPlan\.plan\.decision==="finish"\)/);
  assert.doesNotMatch(block,/action:"interact"/);
  assert.doesNotMatch(block,/decision==="click"/);
  assert.doesNotMatch(block,/decision==="type"/);
});

test("existing browser safety guardrails remain",()=>{
  assert.match(agent,/Do not bypass CAPTCHAs or anti-bot systems/);
  assert.match(agent,/highImpactAutonomy:false/);
  assert.match(agent,/rawCodeExecution:false/);
  assert.match(agent,/domainAllowed\(page\.url\|\|startUrl,allowedDomains\)/);
});


test("title shortcut is strict and cannot truncate a composite observation goal",()=>{
  const start=agent.indexOf("function directSatisfaction");
  const end=agent.indexOf("function stripFence",start);
  const block=agent.slice(start,end);
  assert.match(block,/titleOnly/);
  assert.match(block,/what\(\?:'s\| is\)/);
  assert.doesNotMatch(block,/asksTitle/);
  assert.doesNotMatch(block,/asksNavigation/);
});
