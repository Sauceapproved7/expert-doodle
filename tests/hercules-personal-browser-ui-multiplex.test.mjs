import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Personal Browser UI uses the multiplexed Private Bridge endpoint",()=>{
  assert.doesNotMatch(ui,/functions\/v1\/hercules-personal-browser-bridge/);
  assert.match(ui,/personalBrowserCall\([^)]*\)[\s\S]*call\('hercules-private-bridge'/);
});

test("Personal Browser UI uses namespaced bridge actions",()=>{
  assert.match(ui,/personal_browser_create_pair/);
  assert.match(ui,/personal_browser_owner_status/);
  assert.doesNotMatch(ui,/action:'create_pair'/);
  assert.doesNotMatch(ui,/action:'owner_status'/);
});
