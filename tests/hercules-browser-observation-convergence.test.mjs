import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(
  new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),
  "utf8"
);

test("browser agent exposes navigation-observation convergence version",()=>{
  assert.match(agent,/version:"0\.11\.0"/);
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

test("navigate-first observation uses a dedicated non-action evaluator",()=>{
  const start=agent.indexOf('async function aiObserve');
  const end=agent.indexOf('async function updateRun',start);
  const block=agent.slice(start,end);
  assert.match(block,/Hercules Browser Observation Evaluator/);
  assert.match(block,/complete must be true only if every requested fact/);
  assert.match(block,/Never request or suggest clicks, typing, extraction, login, purchase/);
  assert.doesNotMatch(block,/decision must be one of finish, click, type, extract, wait/);
});

test("observation convergence requires complete answer and otherwise falls back",()=>{
  const start=agent.indexOf('if(observationOnlyGoal(goal,inputKeys))');
  const end=agent.indexOf('for(let i=0;i<maxSteps;i++){',start);
  const block=agent.slice(start,end);
  assert.match(block,/observed\.observation\.complete&&observed\.observation\.answer/);
  assert.match(block,/convergence:"navigate_observation_complete"/);
  assert.match(block,/decision:"observation_fallback"/);
  assert.doesNotMatch(block,/action:"interact"/);
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

test("observation evaluator parser rejects action-shaped output by schema omission",()=>{
  assert.match(agent,/function parseObservation/);
  assert.match(agent,/complete:p\.complete===true/);
  assert.match(agent,/answer:typeof p\.answer==="string"/);
  const start=agent.indexOf("function parseObservation");
  const end=agent.indexOf("async function browserCall",start);
  const block=agent.slice(start,end);
  assert.doesNotMatch(block,/selector:/);
  assert.doesNotMatch(block,/inputKey:/);
  assert.doesNotMatch(block,/ms:/);
});
