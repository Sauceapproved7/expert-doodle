import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927213000_hercules_pilot_outreach_queue_v1.sql",import.meta.url),
  "utf8"
);

test("pilot outreach queue is separate from receivables and inbound leads",()=>{
  assert.match(migration,/create table if not exists public\.hercules_pilot_outreach_queue/i);
  assert.match(migration,/account_name/i);
  assert.match(migration,/domain/i);
  assert.match(migration,/public_company_route/i);
  assert.match(migration,/route_kind/i);
  assert.match(migration,/message_subject/i);
  assert.match(migration,/message_body/i);
  assert.match(migration,/tracking_url/i);
  assert.match(migration,/source_evidence/i);
  assert.doesNotMatch(migration,/insert into public\.marketing_contacts/i);
  assert.doesNotMatch(migration,/insert into public\.hercules_revenue_leads/i);
});

test("queue is fail-closed and draft-only",()=>{
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/revoke all on public\.hercules_pilot_outreach_queue from public, anon, authenticated/i);
  assert.match(migration,/grant select, insert, update on public\.hercules_pilot_outreach_queue to service_role/i);
  assert.match(migration,/status text not null default 'prepared'/i);
  assert.match(migration,/status in \('prepared','reviewed','authorized','sent','suppressed','invalid'\)/i);
  assert.match(migration,/suppressed boolean not null default false/i);
  assert.doesNotMatch(migration,/net\.http_post|sendgrid|resend|smtp|gmail/i);
  assert.doesNotMatch(migration,/personal_email|first_name|last_name|mobile_phone|direct_phone/i);
});

test("first five company-level targets are preloaded without personal contacts",()=>{
  assert.match(migration,/Crystalia Glass/i);
  assert.match(migration,/JK Welding/i);
  assert.match(migration,/Marchon Partners/i);
  assert.match(migration,/Blue Signal Search/i);
  assert.match(migration,/East 57th Street Partners/i);
  assert.match(migration,/acct-crystalia-glass-01/);
  assert.match(migration,/acct-jk-welding-01/);
  assert.match(migration,/acct-marchon-partners-01/);
  assert.match(migration,/acct-blue-signal-01/);
  assert.match(migration,/acct-e57partners-01/);
});
