import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {evaluateMonitorContract} from "../supabase/functions/hercules-ops-monitor/contracts.mjs";

const migration=new URL("../supabase/migrations/20260928080000_hercules_functional_monitoring_v2.sql",import.meta.url);
const monitor=new URL("../supabase/functions/hercules-ops-monitor/index.ts",import.meta.url);
const chat=new URL("../hercules-chat/hercules-chat-edge.ts",import.meta.url);
const rescue=new URL("../supabase/functions/hercules-revenue-rescue/index.ts",import.meta.url);

test("public launch monitor fails closed when a protected launch invariant changes",()=>{
  const result=evaluateMonitorContract({
    expected:"public-launch-contract",
    status:200,
    contentType:"application/json",
    body:{
      ok:true,
      service:"hercules-launch",
      controlled_pilot_open:true,
      paid_billing_active:false,
      public_account_registration_open:true
    }
  });
  assert.equal(result.ok,false);
  assert.equal(result.functional_ok,false);
  assert.equal(result.reason,"launch_contract_mismatch");
});

test("public launch page monitor requires all controlled-pilot markers",()=>{
  const bad=evaluateMonitorContract({
    expected:"launch-page-contract",
    status:200,
    contentType:"text/html",
    text:"Hercules Revenue Recovery by SauceApproved\nFounding Pilot applications are open."
  });
  assert.equal(bad.ok,false);
  const good=evaluateMonitorContract({
    expected:"launch-page-contract",
    status:200,
    contentType:"text/html",
    text:"Hercules Revenue Recovery by SauceApproved\nFounding Pilot applications are open.\nPaid billing and general public account creation remain closed."
  });
  assert.equal(good.ok,true);
});

test("DevBrain monitoring distinguishes functional evidence from freshness",()=>{
  const now=Date.parse("2026-09-28T08:00:00Z");
  const stale=evaluateMonitorContract({
    expected:"devbrain-freshness",
    status:200,
    contentType:"application/json",
    nowMs:now,
    body:{
      ok:true,
      service:"hercules-devbrain-fabric",
      lastCheck:{overall_ok:true,checked_at:"2026-09-27T07:59:59Z"}
    }
  });
  assert.equal(stale.functional_ok,true);
  assert.equal(stale.freshness_ok,false);
  assert.equal(stale.ok,false);
  assert.equal(stale.reason,"devbrain_evidence_stale");

  const fresh=evaluateMonitorContract({
    expected:"devbrain-freshness",
    status:200,
    contentType:"application/json",
    nowMs:now,
    body:{
      ok:true,
      service:"hercules-devbrain-fabric",
      lastCheck:{overall_ok:true,checked_at:"2026-09-28T07:45:00Z"}
    }
  });
  assert.equal(fresh.ok,true);
  assert.equal(fresh.freshness_ok,true);
});

test("declared HTML health surfaces are validated as functional HTML, not forced through JSON",()=>{
  for(const expected of ["html","html-ok","html-200"]){
    const good=evaluateMonitorContract({
      expected,
      status:200,
      contentType:"text/html; charset=utf-8",
      text:"<!doctype html><title>Hercules</title>"
    });
    assert.equal(good.ok,true,expected);
    assert.equal(good.functional_ok,true,expected);
  }
  const empty=evaluateMonitorContract({
    expected:"html-200",
    status:200,
    contentType:"text/html",
    text:""
  });
  assert.equal(empty.ok,false);
  assert.equal(empty.reason,"html_health_failed");
});

test("legacy protected 401 is reachability evidence, never functional proof",()=>{
  const result=evaluateMonitorContract({
    expected:"auth-or-json-health",
    status:401,
    contentType:"application/json",
    body:{error:"unauthorized"}
  });
  assert.equal(result.ok,true);
  assert.equal(result.reachability_ok,true);
  assert.equal(result.functional_ok,null);
  assert.equal(result.verification_level,"reachability_only");
});

test("authenticated internal health requires a positive JSON service contract",()=>{
  const good=evaluateMonitorContract({
    expected:"internal-json-health",
    serviceSlug:"hercules-chat",
    status:200,
    contentType:"application/json",
    body:{ok:true,service:"hercules-chat"}
  });
  assert.equal(good.ok,true);
  assert.equal(good.verification_level,"authenticated_functional");

  const wrongService=evaluateMonitorContract({
    expected:"internal-json-health",
    serviceSlug:"hercules-chat",
    status:200,
    contentType:"application/json",
    body:{ok:true,service:"different-service"}
  });
  assert.equal(wrongService.ok,false);
});

test("production registry declares public, customer-path, and DevBrain functional checks",async()=>{
  const sql=await readFile(migration,"utf8");
  for(const slug of ["hercules-launch","hercules-launch-page","hercules-devbrain-fabric","hercules-chat","hercules-revenue-rescue"]){
    assert.equal(sql.includes("'"+slug+"'"),true,slug+" registry row missing");
  }
  assert.match(sql,/'public-launch-contract'/);
  assert.match(sql,/'launch-page-contract'/);
  assert.match(sql,/'devbrain-freshness'/);
  assert.match(sql,/'internal-json-health'/);
  assert.match(sql,/'max_age_seconds',86400/);
});

test("customer-path health stays behind service JWT and the dedicated monitor key",async()=>{
  const [monitorSource,chatSource,rescueSource]=await Promise.all([
    readFile(monitor,"utf8"),
    readFile(chat,"utf8"),
    readFile(rescue,"utf8")
  ]);
  assert.match(monitorSource,/x-hercules-internal-key/);
  assert.match(monitorSource,/authorization:"Bearer "\+J/);
  assert.match(chatSource,/purpose=eq\.ops-monitor/);
  assert.match(chatSource,/INTERNAL_MONITOR_AUTHORIZATION_REQUIRED/);
  assert.match(rescueSource,/eq\.ops-monitor/);
  assert.match(rescueSource,/internal_monitor_authorization_required/);
});
