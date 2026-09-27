import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const registry=JSON.parse(await readFile(
  new URL("../governance/hercules-privacy-retention-v1.json",import.meta.url),
  "utf8"
));
const runbook=await readFile(
  new URL("../docs/launch/HERCULES-RETENTION-VERIFICATION-2026-09-27.md",import.meta.url),
  "utf8"
);
const chatBackend=await readFile(
  new URL("../hercules-chat/sql/backend-v1.sql",import.meta.url),
  "utf8"
);

test("retention registry records existing automatic cleanup without inventing customer-content TTLs",()=>{
  assert.equal(registry.schema,"hercules.privacy-retention.v1");
  const byId=Object.fromEntries(registry.controls.map(x=>[x.id,x]));
  assert.equal(byId.service_health_checks.mode,"automatic");
  assert.equal(byId.service_health_checks.days,30);
  assert.equal(byId.resolved_service_incidents.days,90);
  assert.equal(byId.ai_runs.days,90);
  assert.equal(byId.rate_limit_buckets.days,2);
  assert.equal(byId.chat_memories.mode,"expires_at");
  for(const id of ["projects","sessions","chat_sessions","chat_messages","chat_tool_calls"]){
    assert.equal(byId[id].mode,"verified_rights_request");
    assert.equal(byId[id].days,null);
  }
});

test("protected and review records remain fail-closed with no invented purge schedule",()=>{
  const byId=Object.fromEntries(registry.controls.map(x=>[x.id,x]));
  for(const id of ["privacy_requests","memberships","usage","usage_events","billing","audit_log","security_events","release_evidence"]){
    assert.equal(byId[id].automatic_purge,false);
    assert.equal(byId[id].days,null);
  }
  assert.match(runbook,/no blanket time-based purge/i);
  assert.match(runbook,/verified privacy request/i);
  assert.match(runbook,/legal, tax, accounting, contractual, dispute, or security/i);
});

test("source-backed chat cleanup periods match the retention registry",()=>{
  assert.match(chatBackend,/hercules_rate_limit_buckets[\s\S]*interval '2 days'/i);
  assert.match(chatBackend,/hercules_ai_runs[\s\S]*interval '90 days'/i);
  assert.match(chatBackend,/hercules_chat_memories[\s\S]*expires_at[\s\S]*<= now\(\)/i);
});
