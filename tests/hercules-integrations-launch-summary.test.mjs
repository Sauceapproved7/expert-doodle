import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(
  new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),
  "utf8"
);

test("Integrations renders a concise launch summary",()=>{
  assert.match(ui,/Launch Readiness/);
  assert.match(ui,/id="launchsummary"/);
  assert.match(ui,/function renderLaunchSummary/);
  assert.match(ui,/READY EXCEPT DOMAIN/);
  assert.match(ui,/AUTHORIZATION NEEDED/);
});

test("launch summary uses the authenticated production-domain status surface",()=>{
  assert.match(ui,/hercules-domains/);
  assert.match(ui,/action:'production_status'/);
  assert.match(ui,/organization_id:ORG/);
  assert.match(ui,/d\?\.production/);
});

test("summary distinguishes storefront readiness from final domain cutover",()=>{
  assert.match(ui,/storefront_status==='verified'/);
  assert.match(ui,/g\.storefrontReady/);
  assert.match(ui,/g\.domainComplete/);
  assert.match(ui,/shopifyCutover/);
  assert.match(ui,/credentialState/);
});

test("owner action is reduced to the actual remaining registrar boundary",()=>{
  assert.match(ui,/Authorize Spaceship DNS with dnsrecords:read \+ dnsrecords:write/);
  assert.match(ui,/Automatic DNS reconcile \/ propagation/);
  assert.match(ui,/Shopify custom-domain \+ SSL cutover/);
});

test("raw launch data remains available without exposing stored credentials",()=>{
  assert.match(ui,/Raw launch data/);
  assert.doesNotMatch(ui,/HERCULES_SPACESHIP_API_SECRET/);
  assert.doesNotMatch(ui,/SHOPIFY_ACCESS_TOKEN/);
  assert.doesNotMatch(ui,/X-Shopify-Access-Token/);
});
