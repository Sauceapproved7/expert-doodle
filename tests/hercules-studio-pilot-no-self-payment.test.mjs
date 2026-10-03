import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,"..");
const migrations=resolve(repo,"supabase/migrations");
const migrationName=readdirSync(migrations).find(x=>x.includes("studio_pilot_no_self_payment_v1"));

test("Studio pilot launch does not require an owner self-purchase",()=>{
  assert.ok(migrationName);
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  assert.match(sql,/payment_launch_capability/);
  assert.match(sql,/post_launch_observation/);
  assert.match(sql,/first_real_customer_order/);
  assert.match(sql,/hercules_activate_studio_pilot_checkout/);
});

test("prelaunch capability and postlaunch live observation remain separate",()=>{
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  assert.match(sql,/payment_launch_capability/);
  assert.match(sql,/payment_path_verified/);
  assert.match(sql,/post_launch_observation_required/);
  assert.match(sql,/checkout_enabled=true/);
});

test("activation still requires owner commercial and provider gates",()=>{
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  for(const gate of ["pricing","terms","privacy","payment_provider_ready","payment_launch_capability"]){
    assert.match(sql,new RegExp(gate));
  }
  assert.match(sql,/service_role_required/);
  assert.match(sql,/studio_pilot_launch_gates_required/);
});
