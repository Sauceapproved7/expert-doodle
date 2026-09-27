import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const browser=await readFile(
  new URL("../supabase/functions/hercules-browser/index.ts",import.meta.url),
  "utf8"
);
const agent=await readFile(
  new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),
  "utf8"
);

test("browser gateway classifies provider security verification without bypassing it",()=>{
  assert.match(browser,/function detectSecurityVerification\(/);
  assert.match(browser,/just a moment/i);
  assert.match(browser,/performing security verification/i);
  assert.match(browser,/verify you are not a bot/i);
  assert.match(browser,/security_verification_required/);
  assert.match(browser,/verificationRequired/);
  assert.doesNotMatch(browser,/antiBotBypass\s*:\s*true/i);
});

test("browser agent stops at verification boundary before planning interactions",()=>{
  assert.match(agent,/function detectSecurityVerification\(/);
  assert.match(agent,/security_verification_required/);
  assert.match(agent,/status:"verification_required"/);
  assert.match(agent,/preserveSession:true/);
  assert.doesNotMatch(agent,/antiBotBypass\s*:\s*true/i);

  const navigate=agent.indexOf('const nav=await browserCall({action:"navigate"');
  const gate=agent.indexOf("const initialVerification=detectSecurityVerification(page)");
  const planner=agent.indexOf("const deterministic=deterministicObservation");
  assert.ok(navigate>=0&&gate>navigate&&planner>gate,"verification gate must run immediately after navigation and before planning");
});
