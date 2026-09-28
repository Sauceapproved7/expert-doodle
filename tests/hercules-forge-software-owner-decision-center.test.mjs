import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");
const provider=await readFile(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");

test("Studio and Ads commercial status is owner-scoped and sanitized",()=>{
  assert.match(bridge,/software_commercial_status/);
  assert.match(bridge,/hercules_software_commercial_approvals/);
  assert.match(bridge,/sauceapproved-studio/);
  assert.match(bridge,/sauceapproved-ads/);
  const block=bridge.slice(bridge.indexOf("if(action==='software_commercial_status')"),bridge.indexOf("if(action==='software_commercial_approve')"));
  assert.doesNotMatch(block,/approved_by/);
});

test("software approvals require authenticated owner and explicit product-specific confirmation",()=>{
  const block=bridge.slice(bridge.indexOf("if(action==='software_commercial_approve')"));
  assert.match(block,/String\(a\.m\.role\)!=='owner'/);
  assert.match(block,/owner_required/);
  assert.match(block,/APPROVE /);
  assert.match(block,/hercules_software_owner_approve/);
});

test("Integrations exposes product-specific owner decision center without auto approval",()=>{
  assert.match(ui,/Studio & Ads Commercial Decisions/);
  assert.match(ui,/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1\.md/);
  assert.match(ui,/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1\.md/);
  assert.match(ui,/SauceApproved Studio/);
  assert.match(ui,/SauceApproved Ads/);
  assert.match(ui,/window\.confirm/);
  assert.match(ui,/software_commercial_approve/);
  assert.doesNotMatch(ui,/software_commercial_approve[^\n]+APPROVE sauceapproved/i);
});

test("Hercules Stripe Direct marks only provider readiness after successful owned connection",()=>{
  const block=provider.slice(provider.indexOf("if(action==='configure_stripe')"));
  assert.match(provider,/syncSoftwareProviderReady/);
  assert.match(provider,/hercules_software_record_payment_gate/);
  assert.match(provider,/payment_provider_ready/);
  assert.match(provider,/sauceapproved-studio/);
  assert.match(provider,/sauceapproved-ads/);
  assert.ok(block.indexOf("upsertConnection(admin,org,'stripe'") < block.indexOf("syncSoftwareProviderReady"));
  assert.doesNotMatch(block,/payment_path_verified[^\n]*true/);
});
