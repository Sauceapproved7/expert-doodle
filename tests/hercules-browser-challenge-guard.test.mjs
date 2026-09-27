import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),"utf8");

test("browser agent detects anti-bot verification pages before planning",()=>{
  assert.match(agent,/function securityChallenge\(page:any\)/);
  assert.match(agent,/performing security verification/);
  assert.match(agent,/verifies you are not a bot/);
  assert.match(agent,/verify you are human/);
  assert.match(agent,/captcha/);
  const initial=agent.indexOf("const initialChallenge=securityChallenge(page)");
  const planner=agent.indexOf("const planned=await aiPlan");
  assert.ok(initial>=0 && planner>initial);
});

test("challenge state fails closed instead of waiting or bypassing",()=>{
  assert.match(agent,/error:initialChallenge\.type/);
  assert.match(agent,/status:"blocked"/);
  assert.match(agent,/anti_bot_verification_required/);
  assert.match(agent,/Do not bypass CAPTCHAs or anti-bot systems/);
  assert.match(agent,/antiBotBypass:false/);
});

test("challenge page cannot be mistaken for a satisfied title request",()=>{
  const challenge=agent.indexOf("const initialChallenge=securityChallenge(page)");
  const direct=agent.indexOf("const direct=directSatisfaction(goal,page,history)");
  assert.ok(challenge>=0 && direct>challenge);
  assert.match(agent,/version:"0\.6\.0"/);
});
