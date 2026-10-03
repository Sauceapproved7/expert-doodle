import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rpcPath = new URL('../supabase/migrations/20261003060100_hercules_shopify_bulk_reconciliation_rpc_v1.sql', import.meta.url);
const schemaPath = new URL('../supabase/migrations/20261003060000_hercules_shopify_bulk_reconciliation_v1.sql', import.meta.url);
const edgePath = new URL('../supabase/functions/hercules-shopify-bulk-reconciliation/index.ts', import.meta.url);

test('bulk order state RPC validates tenant, Shopify identity, state, timestamps, hash, and payload', async () => {
  const sql = await readFile(rpcPath, 'utf8');
  assert.match(sql, /p_resource_gid !~ '\^gid:\/\/shopify\/Order\/\[0-9\]\+\$'/);
  assert.match(sql, /p_updated_at is null/);
  assert.match(sql, /p_payload_sha256[\s\S]*!~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(sql, /p_canonical_state is null[\s\S]*jsonb_typeof\(p_canonical_state\) <> 'object'/);
  assert.match(sql, /where id=p_run_id and tenant_id=p_tenant_id and status='processing'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /revoke all on function public\.hercules_shopify_upsert_bulk_order_state_v1[\s\S]*from public,anon,authenticated/);
  assert.match(sql, /grant execute on function public\.hercules_shopify_upsert_bulk_order_state_v1[\s\S]*to service_role/);
});

test('watermark advances only in an atomic completed-run finalizer', async () => {
  const sql = await readFile(rpcPath, 'utf8');
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /status in \('requested','running','queued','downloading','processing','completed','failed'\)/);
  assert.match(schema, /where status in \('requested','running','queued','downloading','processing'\)/);
  assert.match(sql, /v_run\.status <> 'processing'/);
  assert.match(sql, /p_records_inserted \+ p_records_updated \+ p_records_skipped <> p_records_seen/);
  assert.match(sql, /set status='completed'[\s\S]*insert into public\.hercules_shopify_bulk_reconciliation_watermarks/);
  assert.match(sql, /greatest\([\s\S]*last_successful_updated_at/);
  assert.doesNotMatch(sql, /last_successful_updated_at\s*=\s*now\(\)/);
});

test('bulk processor fetches result URL from Shopify and leaves order commerce effects isolated', async () => {
  const source = await readFile(edgePath, 'utf8');
  assert.match(source, /bulkOperation\(id: \$id\)[\s\S]*url errorCode/);
  assert.match(source, /redirect: 'error'/);
  assert.match(source, /streamJsonl\(response\.body/);
  assert.match(source, /hercules_shopify_upsert_bulk_order_state_v1/);
  assert.match(source, /hercules_shopify_complete_bulk_reconciliation_v1/);
  assert.doesNotMatch(source, /refundCreate|fulfillmentCreate|orderCancel|entitlement/i);
});
