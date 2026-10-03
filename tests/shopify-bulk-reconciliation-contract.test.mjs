import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = path => readFile(new URL(path, import.meta.url), 'utf8');
const [schema, rpc, endpoint, workflow] = await Promise.all([
  load('../supabase/migrations/20261003060000_hercules_shopify_bulk_reconciliation_v1.sql'),
  load('../supabase/migrations/20261003060100_hercules_shopify_bulk_reconciliation_rpc_v1.sql'),
  load('../supabase/functions/hercules-shopify-bulk-reconciliation/index.ts'),
  load('../.github/workflows/hercules-shopify-paid-order-reconciliation.yml')
]);

test('reconciliation tables are service-only with row-level security enabled', () => {
  for (const table of [
    'hercules_shopify_bulk_reconciliation_runs',
    'hercules_shopify_bulk_reconciliation_watermarks',
    'hercules_shopify_bulk_resource_state',
    'hercules_shopify_bulk_webhook_receipts'
  ]) {
    assert.ok((schema + rpc).includes('alter table public.' + table + ' enable row level security'));
    assert.ok((schema + rpc).includes('revoke all on public.' + table + ' from public, anon, authenticated'));
  }
});

test('state upserts bind tenant and processing run, validate snapshots, and reject stale updates', () => {
  assert.match(rpc, /where id\s*=\s*p_run_id\s+and tenant_id\s*=\s*p_tenant_id[\s\S]*and status\s*=\s*'processing'/);
  assert.match(rpc, /p_resource_gid\s+!~\s+'\^gid:\/\/shopify\/Order\/\[0-9\]\+\$'/);
  assert.match(rpc, /p_updated_at is null/);
  assert.match(rpc, /p_payload_sha256[\s\S]*!~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(rpc, /jsonb_typeof\(p_canonical_state\) <> 'object'/);
  assert.match(rpc, /if p_updated_at < v_current\.shopify_updated_at then return 'skipped'/);
  assert.match(rpc, /pg_advisory_xact_lock/);
  assert.match(rpc, /revoke all on function public\.hercules_shopify_upsert_bulk_order_state_v1[\s\S]*from public, anon, authenticated/);
  assert.match(rpc, /grant execute on function public\.hercules_shopify_upsert_bulk_order_state_v1[\s\S]*to service_role/);
});

test('watermark advances only in the atomic successful-run finalizer', () => {
  assert.match(rpc, /v_run\.status <> 'processing' or v_run\.records_failed <> 0/);
  assert.match(rpc, /p_records_seen is null[\s\S]*p_records_skipped is null/);
  assert.match(rpc, /p_records_inserted \+ p_records_updated \+ p_records_skipped <> p_records_seen/);
  assert.match(rpc, /set status = 'completed'[\s\S]*insert into public\.hercules_shopify_bulk_reconciliation_watermarks/);
  assert.match(rpc, /greatest\([\s\S]*last_successful_updated_at/);
  assert.match(rpc, /revoke all on function public\.hercules_shopify_complete_bulk_reconciliation_v1[\s\S]*from public, anon, authenticated/);
  assert.match(rpc, /grant execute on function public\.hercules_shopify_complete_bulk_reconciliation_v1[\s\S]*to service_role/);
  assert.doesNotMatch(schema, /create or replace function public\.hercules_shopify_complete_bulk_reconciliation_v1/);
});

test('completion ingress verifies raw HMAC before parsing and deduplicates delivery IDs', () => {
  const start = endpoint.indexOf('async function handleCompletion');
  const end = endpoint.indexOf('async function readBoundedBody', start);
  const handler = endpoint.slice(start, end);
  assert.ok(handler.indexOf('verifyShopifyWebhookHmac') < handler.indexOf('JSON.parse'));
  assert.ok(handler.includes('x-shopify-topic'));
  assert.ok(handler.includes("from('hercules_shopify_bulk_webhook_receipts').insert"));
  assert.ok(handler.includes("status: 'queued'"));
});

test('bulk start subscribes first and keeps order payloads free of PII', () => {
  const subscription = endpoint.indexOf('await ensureCompletionSubscription(token)');
  const launch = endpoint.indexOf('LaunchBulkOrders');
  assert.ok(subscription >= 0 && launch > subscription);
  assert.ok(endpoint.includes('orders(query:'));
  assert.doesNotMatch(endpoint, /customerEmail|shippingAddress|buyerEmail|email:/i);
  assert.ok(endpoint.includes("updated_at:>=' + cursorStart.toISOString()"));
  assert.ok(endpoint.includes('60 * 24 * 60 * 60 * 1000'));
});

test('bulk correction changes local order-state only and does not invoke commerce effects', () => {
  assert.ok(endpoint.includes('bulkOperation(id: $id)'));
  assert.ok(endpoint.includes("redirect: 'error'"));
  assert.ok(endpoint.includes('streamJsonl(response.body'));
  assert.ok(endpoint.includes('hercules_shopify_upsert_bulk_order_state_v1'));
  assert.doesNotMatch(endpoint, /hercules_reconcile_verified_shopify_paid_order_v1|write_orders|write_fulfillments|refundCreate|fulfillmentCreate|orderCancel/i);
});

test('workflow invokes focused tests without duplicate run keys', () => {
  assert.ok(workflow.includes('tests/shopify-bulk-jsonl.test.mjs'));
  assert.ok(workflow.includes('tests/shopify-bulk-reconciliation-contract.test.mjs'));
  assert.equal(workflow.split('\n').filter(line => line.trimStart().startsWith('run:')).length, 2);
});
