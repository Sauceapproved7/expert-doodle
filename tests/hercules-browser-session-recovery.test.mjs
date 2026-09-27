import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const agent=await readFile(
  new URL("../supabase/functions/hercules-browser-agent/index.ts",import.meta.url),
  "utf8"
);

test("browser agent exposes session recovery version",()=>{
  assert.match(agent,/version:"0\.12\.0"/);
  assert.match(agent,/transientClosedBrowser/);
  assert.match(agent,/target page, context or browser has been closed/i);
});

test("recovery is capped at one fresh session",()=>{
  assert.match(agent,/let recoveries=0/);
  assert.match(agent,/if\(recoveries>=1\)throw new Error\("browser_session_recovery_exhausted"\)/);
  assert.match(agent,/recoveries\+\+/);
});

test("recovery is forbidden after stateful click or type history",()=>{
  assert.match(agent,/function replaySafe\(history:any\[\]\)/);
  assert.match(agent,/item\?\.decision==="click"\|\|item\?\.decision==="type"/);
  assert.match(agent,/browser_session_recovery_not_replay_safe/);
});

test("scrape can recover one transient closed session",()=>{
  assert.match(agent,/transient_scrape_page_closed/);
  assert.match(agent,/scrape=await browserCall/);
  assert.match(agent,/page=await recoverSession\(page\.url\|\|startUrl/);
});

test("interact recovery is limited to extract or wait",()=>{
  assert.match(agent,/const actionReplaySafe=plan\.decision==="extract"\|\|plan\.decision==="wait"/);
  assert.match(agent,/transient_interact_page_closed/);
});

test("recovery preserves domain and autonomy guardrails",()=>{
  assert.match(agent,/domainAllowed\(recovered\.url\|\|recoverUrl,allowedDomains\)/);
  assert.match(agent,/Do not bypass CAPTCHAs or anti-bot systems/);
  assert.match(agent,/highImpactAutonomy:false/);
  assert.match(agent,/rawCodeExecution:false/);
});
