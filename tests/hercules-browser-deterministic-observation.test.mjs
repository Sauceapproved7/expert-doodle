import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(
  new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),
  "utf8"
);

test("browser agent exposes deterministic observation evaluator version",()=>{
  assert.match(agent,/version:"0\.12\.0"/);
  assert.match(agent,/function deterministicObservation/);
  assert.match(agent,/deterministic_navigation_observation/);
});

test("deterministic evaluator is disabled when named inputs exist",()=>{
  assert.match(agent,/if\(inputKeys\.length>0\)return null/);
});

test("deterministic evaluator requires a composite observational request",()=>{
  assert.match(agent,/requested<2/);
  assert.match(agent,/wantsReachable/);
  assert.match(agent,/wantsTitle/);
  assert.match(agent,/wantsProduct/);
  assert.match(agent,/wantsVariants/);
  assert.match(agent,/wantsPurchase/);
});

test("storefront evidence is evaluated from navigation title and text",()=>{
  assert.match(agent,/String\(page\?\.title\|\|""\)\+"\\n"\+String\(page\?\.text\|\|""\)/);
  assert.match(agent,/sauceapproved/);
  assert.match(agent,/hoodie/);
  assert.match(agent,/add to cart/);
  assert.match(agent,/buy it now/);
});

test("deterministic observation completes before planner or scrape",()=>{
  const deterministic=agent.indexOf("const deterministic=deterministicObservation");
  const planner=agent.indexOf("if(observationOnlyGoal(goal,inputKeys))",deterministic);
  const scrape=agent.indexOf('scrape=await browserCall({',planner);
  assert.ok(deterministic>=0 && planner>deterministic && scrape>planner);
});

test("deterministic observation does not execute browser interactions",()=>{
  const start=agent.indexOf("const deterministic=deterministicObservation");
  const end=agent.indexOf("const initialDirect=directSatisfaction",start);
  const block=agent.slice(start,end);
  assert.doesNotMatch(block,/action:"interact"/);
  assert.doesNotMatch(block,/decision:"click"/);
  assert.doesNotMatch(block,/decision:"type"/);
});

test("existing safety controls remain intact",()=>{
  assert.match(agent,/Do not bypass CAPTCHAs or anti-bot systems/);
  assert.match(agent,/highImpactAutonomy:false/);
  assert.match(agent,/rawCodeExecution:false/);
  assert.match(agent,/domainAllowed\(page\.url\|\|startUrl,allowedDomains\)/);
});
