import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const edge=await readFile(
  new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),
  "utf8"
);
const ui=await readFile(
  new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),
  "utf8"
);

test("first-party provider can observe the full launch snapshot",()=>{
  assert.match(edge,/HerculesShopifyLaunchReadiness/);
  assert.match(edge,/themes\(first:20,roles:\[MAIN\]\)/);
  assert.match(edge,/product\(id:"gid:\/\/shopify\/Product\/10258238406976"\)/);
  assert.match(edge,/collections\(first:50\)/);
  assert.match(edge,/menus\(first:20\)/);
  assert.match(edge,/resourcePublicationsV2/);
});

test("launch monitor uses a separate least-privilege internal key",()=>{
  assert.match(edge,/monitor_shopify_launch/);
  assert.match(edge,/shopify-launch-readiness/);
  assert.match(edge,/internalAuthorized\(req,admin,purpose\)/);
  assert.match(edge,/shopify-domain-monitor/);
});

test("provider sends sanitized readiness snapshot to service-role RPC",()=>{
  assert.match(edge,/hercules_shopify_launch_readiness_observe/);
  assert.match(edge,/variantsCount:Number/);
  assert.match(edge,/mediaCount:Number/);
  assert.match(edge,/onlineStore:publicationTitles/);
  assert.match(edge,/launchDrop:collection\('sauceapproved-launch-drop'\)/);
  assert.match(edge,/main:menu\('main-menu'\)/);
  assert.doesNotMatch(edge,/p_access_token|p_client_secret/);
});

test("owner readiness status can use stored state before direct provider authorization",()=>{
  assert.match(edge,/stored_without_provider_authorization/);
  assert.match(edge,/hercules_shopify_launch_readiness_status/);
  assert.match(edge,/action==='shopify_launch_status'/);
});

test("Integrations exposes launch readiness without exposing credentials",()=>{
  assert.match(ui,/Launch Readiness/);
  assert.match(ui,/id="launchstatus"/);
  assert.match(ui,/action:'production_status'/);
  assert.match(ui,/hercules-domains/);
  assert.match(ui,/launchReadinessStatus\(\)/);
  assert.match(ui,/renderLaunchSummary/);
  assert.doesNotMatch(ui,/shpat_[A-Za-z0-9]/);
});
