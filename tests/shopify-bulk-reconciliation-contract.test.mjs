import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

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
    assert.match(schema + rpc, new RegExp('alter table public\\.' + table + ' enable row level security'));
    assert.match(schema + rpc, new RegExp('revoke all on public\\.' + table + ' from public, anon, authenticated'));
  }
});

test('state upserts bind run and tenant and reject stale snapshots', () => {
  assert.match(rpc, /id = p_run_id and tenant_id = p_tenant_id/);
  assert.match(rpc, /status = 'processing'/);
  assert.match(rpc, /p_updated_at < v_current\\.shopify_updated_at then/);
  assert.match(rpc, /p_updated_at = v_current\\.shopify_updated_at/);
  assert.match(rpc, /pg_advisory_xact_lock/);
  assert.match(rpc, /p_resource_gid !~ '\\^gid:\/\/shopify\/Order/);
});

test('watermark advances only in the atomic successful-run finalizer', () => {
  assert.match(schema, /v_run.status <> 'processing' or v_run.records_failed <> 0/);
  assert.match(schema, /p_records_inserted \+ p_records_updated \+ p_records_skipped <> p_records_seen/);
  assert.match(schema, /insert into public\\.hercules_shopify_bulk_reconciliation_watermarks/);
  assert.match(endpoint, /Number\(operation.rootObjectCount\) !== seen/);
  assert.match(endpoint, /hercules_shopify_complete_bulk_reconciliation_v1/);
  assert.ok(endpoint.indexOf('rootObjectCount) !== seen') < endpoint.indexOf('hercules_shopify_complete_bulk_reconciliation_v1'));
});

test('completion ingress verifies raw HMAC before JSON parsing and deduplicates deliveries', () => {
  const start = endpoint.indexOf('async function handleCompletion');
  const end = endpoint.indexOf('async function readBoundedBody', start);
  const handler = endpoint.slice(start, end);
  assert.ok(handler.indexOf('verifyShopifyWebhookHmac') < handler.indexOf('JSON.parse'));
  assert.match(handler, /x-shopify-topic/);
  assert.match(handler, /hercules_shopify_bulk_webhook_receipts.*insert/s);
  assert.match(handler, /status: 'queued'/);
});

test('bulk start subscribes before launching and omits order PII', () => {
  const subscription = endpoint.indexOf('await ensureCompletionSubscription(token)');
  const launch = endpoint.indexOf('LaunchBulkOrders');
  assert.ok(subscription >= 0 && launch > subscription);
  assert.match(endpoint, /orders\(query: \\"/);
  assert.doesNotMatch(endpoint, /customerEmail|shippingAddress|buyerEmail|email:/i);
  assert.match(endpoint, /updated_at:>=' \+ cursorStart\.toISOString\(\)/);
  assert.match(endpoint, /60 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(endpoint, /if \(watermarkError\) throw/);
});

test('bulk correction is local state only and does not invoke paid-order effects', () => {
  assert.doesNotMatch(endpoint, /hercules_reconcile_verified_shopify_paid_order_v1/);
  assert.doesNotMatch(endpoint, /write_orders|write_fulfillments|refundCreate|fulfillmentCreate/);
});

test('workflow invokes focused reconciliation tests and has no duplicate run keys', () => {
  assert.match(workflow, /tests\/shopify-bulk-jsonl\.test\.mjs/);
  assert.match(workflow, /tests\/shopify-bulk-reconciliation-contract\.test\.mjs/);
  const commands = workflow.match(/^        run:/gm) || [];
  assert.equal(commands.length, 2);
});
