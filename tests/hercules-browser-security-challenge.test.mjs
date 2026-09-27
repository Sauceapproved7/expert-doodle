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

test("browser gateway classifies anti-bot/security verification pages explicitly",()=>{
  assert.match(browser,/function detectSecurityChallenge\(/);
  assert.match(browser,/performing security verification/i);
  assert.match(browser,/verify you are not a bot/i);
  assert.match(browser,/securityChallenge/);
  assert.match(browser,/humanVerificationRequired/);
});

test("browser agent blocks on security verification without attempting a bypass",()=>{
  assert.match(agent,/human_verification_required/);
  assert.match(agent,/securityChallenge/);
  assert.match(agent,/preserveSession:true/);
  assert.match(agent,/antiBotBypass:false/);
  assert.doesNotMatch(agent,/bypassCloudflare|solveCaptcha|captchaSolver|stealthBypass/i);
});
