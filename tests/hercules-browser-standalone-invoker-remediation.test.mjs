import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const migration=await readFile(
  new URL("../supabase/migrations/20260927174500_hercules_browser_standalone_private_consume_bridge_v1.sql",import.meta.url),
  "utf8"
);

test("public verifier remains SECURITY INVOKER",()=>{
  assert.match(migration,/create or replace function public\.hercules_browser_standalone_token_consume_public/i);
  assert.match(migration,/security invoker/i);
  assert.doesNotMatch(migration,/hercules_browser_standalone_token_consume_public[\s\S]{0,500}security definer/i);
});

test("anonymous role receives no token-table privileges",()=>{
  assert.match(migration,/revoke all on table private\.hercules_browser_standalone_tokens from anon,authenticated/i);
  assert.doesNotMatch(migration,/grant (select|update|insert|delete)(?:\s*\([^)]*\))? on private\.hercules_browser_standalone_tokens to anon/i);
});

test("private helper performs the privileged atomic consume outside the API schema",()=>{
  assert.match(migration,/create or replace function private\.hercules_browser_standalone_token_consume_bridge/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/set search_path = private, public, extensions, pg_temp/i);
  assert.match(migration,/update private\.hercules_browser_standalone_tokens/i);
  assert.match(migration,/token_sha256\s*=\s*encode\(digest\(p_token,'sha256'\),'hex'\)/i);
  assert.match(migration,/consumed_at is null/i);
  assert.match(migration,/expires_at > now\(\)/i);
  assert.match(migration,/set consumed_at=now\(\)/i);
});

test("public invoker delegates only to the private consume bridge",()=>{
  assert.match(migration,/return private\.hercules_browser_standalone_token_consume_bridge\(p_token\)/i);
});

test("private helper is callable by anon but not directly exposed through public schema",()=>{
  assert.match(migration,/grant usage on schema private to anon/i);
  assert.match(migration,/grant execute on function private\.hercules_browser_standalone_token_consume_bridge\(text\) to anon,service_role/i);
  assert.match(migration,/revoke all on function private\.hercules_browser_standalone_token_consume_bridge\(text\) from public,authenticated/i);
});

test("public verifier execution remains limited to anon and service_role",()=>{
  assert.match(migration,/revoke all on function public\.hercules_browser_standalone_token_consume_public\(text\) from public,authenticated/i);
  assert.match(migration,/grant execute on function public\.hercules_browser_standalone_token_consume_public\(text\) to anon,service_role/i);
});
