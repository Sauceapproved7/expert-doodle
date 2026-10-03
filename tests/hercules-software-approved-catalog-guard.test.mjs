import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(new URL("../supabase/migrations/20260929083000_hercules_approved_catalog_activation_guard_v1.sql",import.meta.url),"utf8");

test("checkout activation requires an explicitly recorded approved catalog",()=>{
  assert.match(migration,/approved_catalog_version/);
  assert.match(migration,/approved_catalog_digest/);
  assert.match(migration,/software_approved_catalog_required/);
  assert.match(migration,/software_catalog_price_mismatch/);
});

test("approved catalog recording is owner-only and bound to an explicit confirmation phrase",()=>{
  assert.match(migration,/owner_access_required/);
  assert.match(migration,/APPROVE SOFTWARE CATALOG/);
  assert.match(migration,/p_catalog_digest/);
  assert.match(migration,/p_catalog_version/);
});

test("checkout activation uses approved evidence instead of legacy implicit price fallbacks",()=>{
  const activation=migration.slice(migration.indexOf("create or replace function public.hercules_activate_software_checkout"));
  assert.doesNotMatch(activation,/candidate_monthly_price_cents in \(2900,7900,19900\)/);
  assert.match(activation,/approved_catalog/);
  assert.match(activation,/checkout_activation_blocked/);
});
