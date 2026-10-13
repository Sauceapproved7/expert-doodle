import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration=await readFile(
  new URL('../supabase/migrations/20261013124500_hercules_management_rpc_private_execution_v1.sql',import.meta.url),'utf8'
);

const signatures=[
  'hercules_supabase_management_store_registration(text,text,text)',
  'hercules_supabase_management_begin_authorization(text,text)',
  'hercules_supabase_management_complete_authorization(text,text,text,timestamptz)',
  'hercules_supabase_management_refresh_tokens(text,text,timestamptz)',
];

test('every management OAuth Vault function is inaccessible to anon and authenticated',()=>{
  for(const signature of signatures){
    assert.ok(migration.includes('public.'+signature),signature+' missing');
  }
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.hercules_supabase_management_store_registration/i);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.hercules_supabase_management_begin_authorization/i);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.hercules_supabase_management_complete_authorization/i);
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.hercules_supabase_management_refresh_tokens/i);
  assert.match(migration,/FROM PUBLIC, anon, authenticated/i);
});

test('service-role Edge caller retains execute, avoiding changes to live owned integrations',()=>{
  for(const signature of signatures)assert.ok(migration.includes('GRANT EXECUTE ON FUNCTION public.'+signature),signature);
  assert.match(migration,/TO service_role/i);
});

test('SQL contains an explicit fail-closed verification for all four functions',()=>{
  assert.match(migration,/has_function_privilege\('anon'/);
  assert.match(migration,/has_function_privilege\('authenticated'/);
  assert.match(migration,/has_function_privilege\('service_role'/);
  assert.match(migration,/raise exception 'management_oauth_rpc_privileges_invalid'/);
});

test('change does not alter checkout, registration settings or provider tokens',()=>{
  assert.doesNotMatch(migration,/\b(update|delete|insert)\b\s+(into\s+)?public\./i);
  assert.doesNotMatch(migration,/public-registration-open|shopify|stripe|billing|checkout/i);
  assert.doesNotMatch(migration,/alter\s+table|create\s+or\s+replace\s+function/i);
});
