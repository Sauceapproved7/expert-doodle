import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Integrations exposes production domain launch status",()=>{
  assert.match(ui,/Production Domain/);
  assert.match(ui,/sauceapproved\.com/);
  assert.match(ui,/action:'production_status'/);
  assert.match(ui,/id="domainstatus"/);
});

test("secure Spaceship setup automatically continues into DNS reconciliation",()=>{
  const save=ui.slice(ui.indexOf("$('shipsave').onclick"),ui.indexOf("sb.auth.onAuthStateChange"));
  assert.match(save,/configure_spaceship_dns/);
  assert.match(save,/await reconcileDomain\(\)/);
  assert.match(save,/\$\('shipkey'\)\.value=''/);
  assert.match(save,/\$\('shipsecret'\)\.value=''/);
});

test("reconcile is explicitly pinned to the owned production domain",()=>{
  assert.match(ui,/confirm_domain:'sauceapproved\.com'/);
  assert.match(ui,/organization_id:ORG/);
  assert.match(ui,/production_reconcile_result/);
  assert.match(ui,/request_id:requestId/);
});

test("UI does not embed registrar credential values",()=>{
  assert.doesNotMatch(ui,/HERCULES_SPACESHIP_API_KEY/);
  assert.doesNotMatch(ui,/HERCULES_SPACESHIP_API_SECRET/);
  assert.doesNotMatch(ui,/X-API-Secret/);
});
