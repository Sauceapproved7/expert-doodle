import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,"..");
const migrations=resolve(repo,"supabase/migrations");
const migrationName=readdirSync(migrations).find(x=>x.includes("hercules_titan_commercial_approval_v1"));
const bridge=readFileSync(resolve(repo,"supabase/functions/hercules-private-bridge/index.ts"),"utf8");
const ui=readFileSync(resolve(repo,"supabase/functions/hercules-integrations/index.ts"),"utf8");
const provider=readFileSync(resolve(repo,"supabase/functions/hercules-provider-connect/index.ts"),"utf8");
const gate=readFileSync(resolve(repo,"supabase/functions/hercules-launch-gate/index.ts"),"utf8");

test("Titan has a dedicated authenticated commercial approval migration",()=>{
  assert.ok(migrationName,"Titan commercial approval migration missing");
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  assert.match(sql,/hercules-titan-founding-access/);
  assert.match(sql,/founding_access_one_time/);
  assert.match(sql,/candidate_price_cents['",:\s]+4900/);
  assert.match(sql,/HERCULES-TITAN-TERMS-CANDIDATE-V1\.md/);
  assert.match(sql,/HERCULES-TITAN-PRIVACY-CANDIDATE-V1\.md/);
  assert.match(sql,/hercules_titan_owner_approve_bundle/);
  assert.match(sql,/APPROVE HERCULES TITAN COMMERCIAL PACKET/);
  assert.match(sql,/role='owner'/);
  assert.match(sql,/pricing/);
  assert.match(sql,/terms/);
  assert.match(sql,/privacy/);
  assert.match(sql,/payment_provider_ready/);
  assert.match(sql,/payment_path_verified/);
  assert.match(sql,/titan_checkout_must_use_shopify_launch_gate/);
});

test("Titan approval path is exposed only through authenticated owner actions",()=>{
  assert.match(bridge,/titan_commercial_bundle_status/);
  assert.match(bridge,/titan_commercial_bundle_approve/);
  assert.match(bridge,/hercules_titan_owner_approve_bundle/);
  assert.match(bridge,/String\(a\.m\.role\)!=='owner'/);
  assert.match(bridge,/hercules-titan-founding-access/);
  assert.match(bridge,/HERCULES-TITAN-TERMS-CANDIDATE-V1\.md/);
  assert.match(bridge,/HERCULES-TITAN-PRIVACY-CANDIDATE-V1\.md/);
});

test("owner UI shows one Titan commercial packet without auto approving it",()=>{
  assert.match(ui,/Titan Founding Access Commercial Packet/);
  assert.match(ui,/\$49 one-time/);
  assert.match(ui,/HERCULES-TITAN-TERMS-CANDIDATE-V1\.md/);
  assert.match(ui,/HERCULES-TITAN-PRIVACY-CANDIDATE-V1\.md/);
  assert.match(ui,/titan_commercial_bundle_status/);
  assert.match(ui,/titan_commercial_bundle_approve/);
  assert.match(ui,/window\.prompt\('Type exactly: '/);
  assert.doesNotMatch(ui,/titan_commercial_bundle_approve[^\n]+confirmation:['"]APPROVE HERCULES TITAN COMMERCIAL PACKET/);
});

test("Titan payment provider readiness uses the Hercules-owned Stripe path",()=>{
  assert.match(provider,/hercules-titan-founding-access/);
  assert.match(provider,/syncSoftwareProviderReady/);
  assert.doesNotMatch(provider,/payment_path_verified[^\n]*true/);
});

test("Shopify Titan alignment additionally requires Titan owner approvals",()=>{
  assert.match(gate,/hercules_software_commercial_approvals/);
  assert.match(gate,/TITAN_PRODUCT_CODE='hercules-titan-founding-access'/);
  assert.match(gate,/titanOwnerApprovalsComplete/);
  assert.match(gate,/shopifyOfferBase &&\s*titanOwnerApprovalsComplete/);
});
