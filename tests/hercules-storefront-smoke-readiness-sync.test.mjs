import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  new URL("../supabase/migrations/20260927090000_hercules_storefront_smoke_readiness_sync_v1.sql",import.meta.url),
  "utf8"
);

test("sync only accepts dedicated storefront smoke runs",()=>{
  assert.match(sql,/new\.requested_by <> 'hercules-storefront-smoke'/);
});

test("verified storefront requires successful browser status and all observations",()=>{
  assert.match(sql,/new\.status='succeeded'/);
  assert.match(sql,/Publicly reachable: yes/);
  assert.match(sql,/SauceApproved hoodie visible: yes/);
  assert.match(sql,/Size\/color variant controls visible: yes/);
  assert.match(sql,/Add-to-cart or purchase control visible: yes/);
});

test("failed or incomplete smoke clears stale verified timestamp",()=>{
  assert.match(sql,/storefront_status=case when v_verified then 'verified' else 'failed' end/);
  assert.match(sql,/storefront_verified_at=case when v_verified then v_when else null end/);
});

test("verification evidence is sanitized and stored without credentials",()=>{
  assert.match(sql,/hercules-storefront-smoke-v1/);
  assert.match(sql,/pageTitle/);
  assert.match(sql,/convergence/);
  assert.match(sql,/browserStatus/);
  assert.doesNotMatch(sql,/access_secret|client_secret|api_secret|internal_key/i);
});

test("sync preserves launch gates and audits while refreshing storefront evidence",()=>{
  assert.match(sql,/snapshot=jsonb_set/);
  assert.match(sql,/\{storefrontVerification\}/);
  assert.doesNotMatch(sql,/gates\s*=/);
  assert.doesNotMatch(sql,/stage\s*=/);
});

test("insert and update triggers both use the same fail-closed sync",()=>{
  assert.match(sql,/after insert/);
  assert.match(sql,/after update of status,result,error,completed_at/);
  assert.match(sql,/hercules_sync_storefront_smoke_to_launch_readiness/);
});
