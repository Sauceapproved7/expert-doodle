import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927173000_hercules_browser_standalone_invoker_remediation_v1.sql",import.meta.url),
  "utf8"
);

test("public verifier runs as invoker, not definer",()=>{
  assert.match(migration,/create or replace function public\.hercules_browser_standalone_token_consume_public/i);
  assert.match(migration,/security invoker/i);
  assert.doesNotMatch(migration,/hercules_browser_standalone_token_consume_public[\s\S]{0,500}security definer/i);
});

test("anon receives only narrow schema and column privileges",()=>{
  assert.match(migration,/grant usage on schema private to anon/i);
  assert.match(migration,/grant select \(token_sha256,purpose,expires_at,consumed_at\) on private\.hercules_browser_standalone_tokens to anon/i);
  assert.match(migration,/grant update \(consumed_at\) on private\.hercules_browser_standalone_tokens to anon/i);
  assert.doesNotMatch(migration,/grant (select|update|insert|delete) on private\.hercules_browser_standalone_tokens to anon/i);
});

test("RLS constrains anonymous token consumption to live one-use rows",()=>{
  assert.match(migration,/create policy "standalone token anon consume"/i);
  assert.match(migration,/for update to anon/i);
  assert.match(migration,/consumed_at is null/i);
  assert.match(migration,/expires_at > now\(\)/i);
  assert.match(migration,/with check \(consumed_at is not null\)/i);
});

test("invoker verifier atomically consumes only the matching hash",()=>{
  assert.match(migration,/update private\.hercules_browser_standalone_tokens/i);
  assert.match(migration,/token_sha256\s*=\s*encode\(digest\(p_token,'sha256'\),'hex'\)/i);
  assert.match(migration,/set consumed_at=now\(\)/i);
  assert.match(migration,/returning purpose,expires_at/i);
});

test("public verifier execution remains limited to anon and service_role",()=>{
  assert.match(migration,/revoke all on function public\.hercules_browser_standalone_token_consume_public\(text\) from public,authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_browser_standalone_token_consume_public\(text\) to anon,service_role/i);
});
