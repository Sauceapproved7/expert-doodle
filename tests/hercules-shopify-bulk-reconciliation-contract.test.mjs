import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const rpcPath = new URL('../supabase/migrations/20261003060100_hercules_shopify_bulk_reconciliation_rpc_v1.sql', import.meta.url);
const schemaPath = new URL('../supabase/migrations/20261003060000_hercules_shopify_bulk_reconciliation_v1.sql', import.meta.url);
const edgePath = new URL('../supabase/functions/hercules-shopify-bulk-reconciliation/index.ts', import.meta.url);

test('bulk order state RPC validates tenant, Shopify identity, state, timestamps, hash, and payload', async () => {
  const sql = await readFile(rpcPath, 'utf8');
  assert.ok(sql.includes("p_resource_gid !~ '^gid://shopify/Order/[0-9]+$'"));
  assert.ok(sql.includes('p_updated_at is null'));
  assert.ok(sql.includes("coalesce(p_payload_sha256, '') !~ '^[a-f0-9]{64}$'"));
  assert.ok(sql.includes("jsonb_typeof(p_canonical_state) <> 'object'"));
  assert.match(sql, /where id = p_run_id\\s+and tenant_id = p_tenant_id/);
  assert.ok(sql.includes("and status = 'processing'"));
  assert.ok(sql.includes('pg_advisory_xact_lock'));
  assert.ok(sql.includes('revoke all on function public.hercules_shopify_upsert_bulk_order_state_v1'));
  assert.ok(sql.includes('grant execute on function public.hercules_shopify_upsert_bulk_order_state_v1'));
});

test('watermark advances only in an atomic completed-run finalizer', async () => {
  const sql = await readFile(rpcPath, 'utf8');
  const schema = await readFile(schemaPath, 'utf8');
  assert.ok(schema.includes("status in ('requested','running','queued','downloading','processing','completed','failed')"));
  assert.ok(schema.includes("where status in ('requested','running','queued','downloading','processing')"));
  assert.ok(schema.includes("v_run.status <> 'processing'"));
  assert.ok(schema.includes('p_records_inserted + p_records_updated + p_records_skipped <> p_records_seen'));
  assert.ok(schema.includes('set status=\'completed\''));
  assert.ok(schema.includes('insert into public.hercules_shopify_bulk_reconciliation_watermarks'));
  assert.ok(schema.includes('greatest('));
  assert.ok(!schema.includes('last_successful_updated_at=now()'));
});

test('bulk processor fetches result URL from Shopify and leaves order commerce effects isolated', async () => {
  const source = await readFile(edgePath, 'utf8');
  assert.ok(source.includes('bulkOperation(id: $id)'));
  assert.ok(source.includes('url errorCode'));
  assert.ok(source.includes("redirect: 'error'"));
  assert.ok(source.includes('streamJsonl(response.body'));
  assert.ok(source.includes('hercules_shopify_upsert_bulk_order_state_v1'));
  assert.ok(source.includes('hercules_shopify_complete_bulk_reconciliation_v1'));
  assert.doesNotMatch(source, /refundCreate|fulfillmentCreate|orderCancel|entitlement/i);
});
