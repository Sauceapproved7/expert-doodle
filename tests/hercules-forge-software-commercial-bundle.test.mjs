import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260929160000_hercules_software_commercial_bundle_v2.sql",import.meta.url),"utf8");

test("software commercial bundle is locked to exact legal docs and catalog",()=>{
  assert.match(bridge,/SAUCEAPPROVED_SOFTWARE_TERMS_SHA='2bf27cfb7f94d5599de509aa8c529a94751023d3'/);
  assert.match(bridge,/SAUCEAPPROVED_SOFTWARE_PRIVACY_SHA='04f6217770cbc53829da36c25ecf3fa6584704fb'/);
  assert.match(bridge,/starter:2900/);
  assert.match(bridge,/pro:7900/);
  assert.match(bridge,/agency:19900/);
  assert.match(bridge,/SOFTWARE_COMMERCIAL_BUNDLE_VERSION='software-commercial-v2'/);
});

test("bundle approval is owner-only and requires one exact typed phrase",()=>{
  const block=bridge.slice(bridge.indexOf("if(action==='software_commercial_bundle_approve')"));
  assert.match(block,/String\(a\.m\.role\)!=='owner'/);
  assert.match(block,/owner_required/);
  assert.match(block,/software_commercial_bundle_version_mismatch/);
  assert.match(block,/software_commercial_bundle_digest_mismatch/);
  assert.match(block,/explicit_confirmation_required/);
  assert.match(bridge,/APPROVE SAUCEAPPROVED SOFTWARE COMMERCIAL PACKET /);
  assert.match(block,/SOFTWARE_COMMERCIAL_BUNDLE_CONFIRMATION/);
});

test("bundle approves pricing Terms and Privacy for both Studio and Ads but not payment gates",()=>{
  const block=bridge.slice(bridge.indexOf("if(action==='software_commercial_bundle_approve')"));
  for(const product of ["sauceapproved-studio","sauceapproved-ads"]) assert.match(block,new RegExp(product));
  for(const gate of ["pricing","terms","privacy"]) assert.match(block,new RegExp(gate));
  assert.doesNotMatch(block,/payment_provider_ready[^\n]*approved/);
  assert.doesNotMatch(block,/payment_path_verified[^\n]*approved/);
  assert.match(block,/hercules_software_owner_approve/);
});

test("Integrations exposes one commercial packet approval without auto approval",()=>{
  assert.match(ui,/Approve Studio \+ Ads commercial packet/);
  assert.match(ui,/software_commercial_bundle_status/);
  assert.match(ui,/software_commercial_bundle_approve/);
  assert.match(ui,/window\.prompt\('Type exactly: '/);
  assert.match(ui,/APPROVE SAUCEAPPROVED SOFTWARE COMMERCIAL PACKET /);
  assert.doesNotMatch(ui,/software_commercial_bundle_approve[^\n]+confirmation:['"]APPROVE/);
});


test("bundle approval is atomic in the database and cannot touch payment gates",()=>{
  assert.match(migration,/hercules_software_owner_approve_bundle/);
  assert.match(migration,/auth\.uid\(\)/);
  assert.match(migration,/role='owner'/);
  assert.match(migration,/software-commercial-v2/);
  assert.match(migration,/cd8f2488748f0aed1e85726816ace5c86288de3f873de7719d136ed9e4275b72/);
  assert.match(migration,/approval_type in \('pricing','terms','privacy'\)/);
  assert.match(migration,/product_code in \('sauceapproved-studio','sauceapproved-ads'\)/);
  assert.doesNotMatch(migration,/payment_provider_ready['"]?\s*,?\s*status='approved'/);
  assert.doesNotMatch(migration,/payment_path_verified['"]?\s*,?\s*status='approved'/);
});
