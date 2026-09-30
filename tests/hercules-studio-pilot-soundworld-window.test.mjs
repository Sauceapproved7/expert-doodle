import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,"..");
const migrations=resolve(repo,"supabase/migrations");
const name=readdirSync(migrations).find(x=>x.includes("studio_pilot_soundworld_window_v1"));

test("Studio pilot can open SoundWorld window from its own approved launch gate",()=>{
  assert.ok(name);
  const sql=readFileSync(resolve(migrations,name),"utf8");
  assert.match(sql,/hercules_soundworld_open_studio_pilot_launch_window/);
  assert.match(sql,/sauceapproved-studio-founding-pilot/);
  for(const gate of ["pricing","terms","privacy","payment_provider_ready","payment_launch_capability"]){
    assert.match(sql,new RegExp(gate));
  }
  assert.match(sql,/checkout_enabled/);
  assert.match(sql,/hercules-soundworld-launch-gift-window/);
  assert.match(sql,/durationDays/);
  assert.match(sql,/14/);
});

test("Studio pilot SoundWorld window does not depend on Titan global launch gate",()=>{
  const sql=readFileSync(resolve(migrations,name),"utf8");
  assert.doesNotMatch(sql,/hercules_launch_gate_checks/);
  assert.doesNotMatch(sql,/payment_path_verified[^\n]*approved/);
  assert.match(sql,/service_role_required/);
});
