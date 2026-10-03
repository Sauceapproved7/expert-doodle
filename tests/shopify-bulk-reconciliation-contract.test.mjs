import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load = path => readFile(new URL(path, import.meta.url), 'utf8');
const [schema, rpc, endpoint, webhook, workflow] = await Promise.all([
  load('../supabase/migrations/20261003060000_hercules_shopify_bulk_reconciliation_v1.sql'),
  load('../supabase/migrations/20261003060100_hercules_shopify_bulk_reconciliation_rpc_v1.sql'),
  load('../supabase/functions/hercules-shopify-bulk-reconciliation/index.ts'),
  load('../supabase/functions/hercules-shopify-webhook/index.ts'),
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

test('state upserts bind run and tenant and reject stale snapshots', () => {
  assert.match(rpc, /where id = p_run_id\s+and tenant_id = p_tenant_id/);
  assert.ok(rpc.includes("and status = 'processing'"));
  assert.ok(rpc.includes('if p_updated_at < v_current.shopify_updated_at then'));
  assert.ok(rpc.includes('if p_updated_at = v_current.shopify_updated_at'));
  assert.ok(rpc.includes('pg_advisory_xact_lock'));
  assert.ok(rpc.includes("p_resource_gid !~ '^gid://shopify/Order/[0-9]+$'"));
});

test('watermark advances only in the atomic successful-run finalizer', () => {
  assert.ok(rpc.includes("v_run.status <> 'processing' or v_run.records_failed <> 0"));
  assert.ok(rpc.includes('p_records_inserted + p_records_updated + p_records_skipped <> p_records_seen'));
  assert.ok(rpc.includes('insert into public.hercules_shopify_bulk_reconciliation_watermarks'));
  assert.ok(endpoint.includes('operation.rootObjectCount == null'));
  assert.ok(endpoint.includes('Number.isSafeInteger(expectedRootCount)'));
  assert.ok(endpoint.includes('expectedRootCount !== seen'));
  assert.ok(endpoint.includes('hercules_shopify_complete_bulk_reconciliation_v1'));
  assert.ok(endpoint.indexOf('Number(operation.rootObjectCount) !== seen') < endpoint.indexOf('hercules_shopify_complete_bulk_reconciliation_v1'));
});

test('completion ingress verifies raw HMAC before JSON parsing and deduplicates deliveries', () => {
  const start = endpoint.indexOf('async function handleCompletion');
  const end = endpoint.indexOf('async function readBoundedBody', start);
  const handler = endpoint.slice(start, end);
  assert.ok(handler.indexOf('verifyShopifyWebhookHmac') < handler.indexOf('JSON.parse'));
  assert.ok(handler.includes('x-shopify-topic'));
  assert.ok(handler.includes("from('hercules_shopify_bulk_webhook_receipts').insert"));
  assert.ok(handler.includes("status: 'queued'"));
});

test('bulk start subscribes before launching and omits order PII', () => {
  const subscription = endpoint.indexOf('await ensureCompletionSubscription(token)');
  const launch = endpoint.indexOf('LaunchBulkOrders');
  assert.ok(subscription >= 0 && launch > subscription);
  assert.ok(endpoint.includes('orders(query:'));
  assert.doesNotMatch(endpoint, /customerEmail|shippingAddress|buyerEmail|email:/i);
  assert.ok(endpoint.includes("updated_at:>=' + cursorStart.toISOString()"));
  assert.ok(endpoint.includes('60 * 24 * 60 * 60 * 1000'));
  assert.ok(endpoint.includes('if (watermarkError) throw'));
});

test('bulk correction is local state only and does not invoke paid-order effects', () => {
  assert.doesNotMatch(endpoint, /hercules_reconcile_verified_shopify_paid_order_v1/);
  assert.doesNotMatch(endpoint, /write_orders|write_fulfillments|refundCreate|fulfillmentCreate/);
});


test('bulk reconciliation is routed through the existing Shopify webhook function slot', () => {
  assert.ok(endpoint.includes("CALLBACK = URL + '/functions/v1/hercules-shopify-webhook/bulk'"));
  assert.ok(endpoint.includes('export async function handleBulkReconciliationRequest'));
  assert.ok(endpoint.includes('if (import.meta.main) Deno.serve(handleBulkReconciliationRequest)'));
  assert.ok(webhook.includes("import { handleBulkReconciliationRequest } from '../hercules-shopify-bulk-reconciliation/index.ts'"));
  const route = webhook.indexOf("endsWith('/hercules-shopify-webhook/bulk')");
  const bodyRead = webhook.indexOf('const raw=await req.text()');
  assert.ok(route >= 0 && bodyRead > route);
});

test('workflow invokes focused reconciliation tests and has no duplicate run keys', () => {
  assert.ok(workflow.includes('tests/shopify-bulk-jsonl.test.mjs'));
  assert.ok(workflow.includes('tests/shopify-bulk-reconciliation-contract.test.mjs'));
  const commands = workflow.split('\n').filter(line => line.trimStart().startsWith('run:'));
  assert.equal(commands.length, 2);
});
