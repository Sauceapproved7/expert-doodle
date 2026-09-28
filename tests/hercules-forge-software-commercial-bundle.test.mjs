import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260928100000_hercules_software_commercial_bundle_v1.sql",import.meta.url),"utf8");

test("software commercial bundle is locked to exact legal docs and catalog",()=>{
  assert.match(bridge,/SAUCEAPPROVED_SOFTWARE_TERMS_SHA='d45b351965b1d93855b004ed230bbff32bee1272'/);
  assert.match(bridge,/SAUCEAPPROVED_SOFTWARE_PRIVACY_SHA='4b1c5cfabb935d069e8de85c91300f9482709695'/);
  assert.match(bridge,/starter:2900/);
  assert.match(bridge,/pro:7900/);
  assert.match(bridge,/agency:19900/);
  assert.match(bridge,/SOFTWARE_COMMERCIAL_BUNDLE_VERSION='software-commercial-v1'/);
});

test("bundle approval is owner-only and requires one exact typed phrase",()=>{
  const block=bridge.slice(bridge.indexOf("if(action==='software_commercial_bundle_approve')"));
  assert.match(block,/String\(a\.m\.role\)!=='owner'/);
  assert.match(block,/owner_required/);
  assert.match(block,/software_commercial_bundle_version_mismatch/);
  assert.match(block,/software_commercial_bundle_digest_mismatch/);
  assert.match(block,/explicit_confirmation_required/);
  assert.match(block,/APPROVE SAUCEAPPROVED SOFTWARE COMMERCIAL PACKET /);
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
  assert.match(migration,/software-commercial-v1/);
  assert.match(migration,/760ce84a641a2642a46de1b039eabdd2e7d45ba9101633284d5bf69f27e09862/);
  assert.match(migration,/approval_type in \('pricing','terms','privacy'\)/);
  assert.match(migration,/product_code in \('sauceapproved-studio','sauceapproved-ads'\)/);
  assert.doesNotMatch(migration,/payment_provider_ready['"]?\s*,?\s*status='approved'/);
  assert.doesNotMatch(migration,/payment_path_verified['"]?\s*,?\s*status='approved'/);
});
