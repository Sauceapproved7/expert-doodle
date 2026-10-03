import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,"..");
const migrations=resolve(repo,"supabase/migrations");
const name=readdirSync(migrations).find(x=>x.includes("studio_pilot_postlaunch_observation_v1"));

test("real customer observation does not require refunding the customer",()=>{
  assert.ok(name);
  const sql=readFileSync(resolve(migrations,name),"utf8");
  assert.match(sql,/hercules_studio_pilot_record_post_launch_observation/);
  assert.match(sql,/real_paid_order_id/);
  assert.match(sql,/transaction_reference/);
  assert.match(sql,/entitlement_evidence/);
  assert.match(sql,/payout_state/);
  assert.doesNotMatch(sql,/refund_or_reversal_reference_required/);
  assert.doesNotMatch(sql,/refund_id_required/);
});

test("payment_path_verified becomes approved only after payout state is verified",()=>{
  const sql=readFileSync(resolve(migrations,name),"utf8");
  assert.match(sql,/payment_path_verified/);
  assert.match(sql,/payout_state/i);
  assert.match(sql,/pending/);
  assert.match(sql,/approved/);
  assert.match(sql,/first_real_customer_order/);
});

test("postlaunch observation remains service-role controlled",()=>{
  const sql=readFileSync(resolve(migrations,name),"utf8");
  assert.match(sql,/service_role_required/);
  assert.match(sql,/grant execute/);
  assert.match(sql,/service_role/);
});
