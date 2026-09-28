import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migrationPath=new URL("../supabase/migrations/20260928123300_hercules_cleaner_verified_live_url_v1.sql",import.meta.url);

test("Cleaner live catalog cutover binds only the verified presentation URL and keeps checkout closed",async()=>{
  const sql=await readFile(migrationPath,"utf8");
  assert.match(sql,/https:\/\/sauceapproved-forge-host\.onrender\.com\/hercules-cleaner\//);
  assert.match(sql,/deploy-dd7e24a1-e7d5-4715-ac1e-737906b876ec/);
  assert.match(sql,/840c402f6ab5d0d0677388902369582618449ad7b898067f424dcc807fc35952/);
  assert.match(sql,/verification_status/);
  assert.match(sql,/verified/);
  assert.match(sql,/checkout_enabled=false/);
  assert.match(sql,/status='early_access'/);
  assert.doesNotMatch(sql,/checkout_enabled=true/);
  assert.doesNotMatch(sql,/pricing_status='approved'/);
});
