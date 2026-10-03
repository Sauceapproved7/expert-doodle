import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { streamJsonl, stableStringify } from '../_shared/shopify-bulk-jsonl.mjs';

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORE = 'sauceapproved-2.myshopify.com';
const API_VERSION = '2026-10';
const CALLBACK = URL + '/functions/v1/hercules-shopify-bulk-reconciliation';
const DB = createClient(URL, SERVICE, { auth: { persistSession: false } });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

async function owner(req: Request) {
  const client = createClient(URL, ANON, {
    global: { headers: { Authorization: req.headers.get('authorization') || '' } },
    auth: { persistSession: false }
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await DB.from('hercules_memberships')
    .select('organization_id,role')
    .eq('user_id', user.id).eq('status', 'active')
    .in('role', ['owner', 'admin']).limit(20);
  if (error || !data?.length) return null;
  return { user, organizations: new Set(data.map((x: any) => String(x.organization_id))) };
}

async function connection(organizationId?: string) {
  let q = DB.from('hercules_provider_connections')
    .select('organization_id,client_id,client_secret_ref,signing_secret_ref,status')
    .eq('provider', 'shopify').eq('account_key', STORE).eq('status', 'active');
  if (organizationId) q = q.eq('organization_id', organizationId);
  const { data, error } = await q.limit(2);
  if (error) throw new Error('shopify_connection_lookup_failed');
  if (!data?.length || data.length > 1) throw new Error('shopify_connection_ambiguous_or_missing');
  return data[0];
}

async function secret(ref: string | null) {
  if (!ref) throw new Error('shopify_secret_reference_missing');
  const { data, error } = await DB.rpc('hercules_get_secret', { p_id: ref });
  if (error || !data) throw new Error('shopify_secret_unavailable');
  return String(data);
}

async function accessToken(conn: any) {
  const clientSecret = await secret(conn.client_secret_ref);
  const response = await fetch('https://' + STORE + '/admin/oauth/access_token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: conn.client_id, client_secret: clientSecret }),
    signal: AbortSignal.timeout(20000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error('shopify_token_exchange_failed');
  return String(body.access_token);
}

async function graphql(token: string, query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch('https://' + STORE + '/admin/api/' + API_VERSION + '/graphql.json', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-shopify-access-token': token },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(30000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) throw new Error('shopify_graphql_request_failed');
  return body.data;
}

async function ensureCompletionSubscription(token: string) {
  const lookup = await graphql(token,
    'query ExistingBulkFinish { webhookSubscriptions(first: 100, topics: [BULK_OPERATIONS_FINISH]) { edges { node { id topic uri } } } }');
  const existing = lookup?.webhookSubscriptions?.edges?.map((e: any) => e.node)
    .find((n: any) => n?.topic === 'BULK_OPERATIONS_FINISH' && n?.uri === CALLBACK);
  if (existing) return String(existing.id);
  const result = await graphql(token,
    'mutation SubscribeBulkFinish($uri: String!) { webhookSubscriptionCreate(topic: BULK_OPERATIONS_FINISH, webhookSubscription: { uri: $uri, format: JSON }) { webhookSubscription { id topic uri } userErrors { field message } } }',
    { uri: CALLBACK });
  const payload = result?.webhookSubscriptionCreate;
  if (payload?.userErrors?.length || !payload?.webhookSubscription?.id) throw new Error('bulk_finish_subscription_failed');
  return String(payload.webhookSubscription.id);
}

async function hashText(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(x => x.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

async function verifyWebhook(raw: Uint8Array, supplied: string, signingSecret: string) {
  if (!supplied) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, raw));
  let binary = '';
  for (const b of digest) binary += String.fromCharCode(b);
  return safeEqual(btoa(binary), supplied);
}

async function startRun(tenantId: string, mode: string) {
  const started = new Date();
  const { data: watermark } = await DB.from('hercules_shopify_bulk_reconciliation_watermarks')
    .select('last_successful_updated_at').eq('tenant_id', tenantId).eq('resource_type', 'orders').maybeSingle();
  const floor = new Date(started.getTime() - 60 * 24 * 60 * 60 * 1000);
  const previous = watermark?.last_successful_updated_at ? new Date(watermark.last_successful_updated_at) : floor;
  const cursorStart = new Date(Math.max(floor.getTime(), previous.getTime() - 30 * 60 * 1000));
  const queryFilter = 'updated_at:>=' + cursorStart.toISOString();
  const queryText = '{ orders(query: "' + queryFilter + '") { edges { node { id updatedAt displayFinancialStatus displayFulfillmentStatus cancelledAt test } } } }';
  const runId = crypto.randomUUID();
  const { data: run, error: runError } = await DB.from('hercules_shopify_bulk_reconciliation_runs').insert({
    id: runId, tenant_id: tenantId, shop_domain: STORE, resource_type: 'orders', mode,
    status: 'requested', started_at: started.toISOString(), cursor_started_at: cursorStart.toISOString(),
    cursor_candidate_at: started.toISOString()
  }).select('id').single();
  if (runError || !run) throw new Error('bulk_run_create_failed');

  try {
    const conn = await connection(tenantId);
    const token = await accessToken(conn);
    await ensureCompletionSubscription(token);
    const result = await graphql(token,
      'mutation LaunchBulkOrders($query: String!) { bulkOperationRunQuery(query: $query, groupObjects: false) { bulkOperation { id status } userErrors { field message } } }',
      { query: queryText });
    const payload = result?.bulkOperationRunQuery;
    if (payload?.userErrors?.length || !payload?.bulkOperation?.id) throw new Error('bulk_operation_launch_rejected');
    const { error } = await DB.from('hercules_shopify_bulk_reconciliation_runs')
      .update({ status: 'running', bulk_operation_gid: String(payload.bulkOperation.id) }).eq('id', runId);
    if (error) throw new Error('bulk_operation_id_persist_failed');
    return { runId, operationId: String(payload.bulkOperation.id), cursorStart: cursorStart.toISOString() };
  } catch (error) {
    await DB.from('hercules_shopify_bulk_reconciliation_runs')
      .update({ status: 'failed', error_code: 'LAUNCH_FAILED', error_message: 'Bulk operation launch failed.' }).eq('id', runId);
    throw error;
  }
}

async function processRun(runId: string) {
  const { data: run, error } = await DB.from('hercules_shopify_bulk_reconciliation_runs')
    .select('id,tenant_id,shop_domain,status,bulk_operation_gid,cursor_candidate_at')
    .eq('id', runId).maybeSingle();
  if (error || !run || !run.bulk_operation_gid || !['queued','failed','processing','downloading'].includes(run.status)) {
    throw new Error('bulk_run_not_processable');
  }
  const { data: claim, error: claimError } = await DB.from('hercules_shopify_bulk_reconciliation_runs')
    .update({ status: 'downloading', error_code: null, error_message: null })
    .eq('id', runId).eq('status', 'queued').select('id').maybeSingle();
  if (claimError || !claim) throw new Error('bulk_run_already_claimed');
  const conn = await connection(run.tenant_id);
  const token = await accessToken(conn);
  const data = await graphql(token,
    'query BulkStatus($id: ID!) { bulkOperation(id: $id) { id status type url errorCode objectCount rootObjectCount completedAt } }',
    { id: run.bulk_operation_gid });
  const operation = data?.bulkOperation;
  if (!operation || operation.id !== run.bulk_operation_gid || operation.type !== 'QUERY' || operation.status !== 'COMPLETED' || !operation.url) {
    throw new Error('bulk_operation_not_complete');
  }
  const downloadUrl = new URL(operation.url);
  if (downloadUrl.protocol !== 'https:' || downloadUrl.username || downloadUrl.password) throw new Error('bulk_result_url_invalid');
  const response = await fetch(downloadUrl, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw new Error('bulk_result_download_failed');

  await DB.from('hercules_shopify_bulk_reconciliation_runs').update({ status: 'processing' }).eq('id', runId);
  const streamed = await streamJsonl(response.body, apply, {
    maxBytes: 512 * 1024 * 1024,
    maxLineBytes: 1024 * 1024
  });
  const seen = streamed.recordsSeen;
  const resultHash = streamed.sha256;
  if (Number(operation.rootObjectCount) !== seen) throw new Error('bulk_result_count_mismatch');
  const { error: finalizeError } = await DB.rpc('hercules_shopify_complete_bulk_reconciliation_v1', {
    p_run_id: runId, p_candidate_at: run.cursor_candidate_at, p_records_seen: seen,
    p_records_inserted: inserted, p_records_updated: updated, p_records_skipped: skipped,
    p_result_sha256: resultHash
  });
  if (finalizeError) throw new Error('bulk_watermark_commit_failed');
  return { runId, recordsSeen: seen, recordsInserted: inserted, recordsUpdated: updated, recordsSkipped: skipped };
}

async function handleCompletion(req: Request, raw: Uint8Array) {
  const shop = (req.headers.get('x-shopify-shop-domain') || '').toLowerCase();
  const deliveryId = req.headers.get('x-shopify-webhook-id') || '';
  const eventId = req.headers.get('x-shopify-event-id');
  if (shop !== STORE || !deliveryId) return json({ error: 'invalid_webhook_identity' }, 401);
  const configuredSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  const conn = configuredSecret ? null : await connection();
  const signingSecret = configuredSecret || await secret(conn.signing_secret_ref);
  if (!await verifyWebhook(raw, req.headers.get('x-shopify-hmac-sha256') || '', signingSecret)) {
    return json({ error: 'invalid_hmac' }, 401);
  }
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: 'invalid_json' }, 400); }
  const operationId = String(payload?.admin_graphql_api_id || '');
  if (!/^gid:\/\/shopify\/BulkOperation\/[0-9]+$/.test(operationId)) return json({ error: 'invalid_operation_id' }, 400);
  const { error: receiptError } = await DB.from('hercules_shopify_bulk_webhook_receipts').insert({
    webhook_id: deliveryId, event_id: eventId || null, shop_domain: STORE, operation_gid: operationId
  });
  if (receiptError && String(receiptError.code) === '23505') return json({ received: true, duplicate: true });
  if (receiptError) return json({ error: 'webhook_persist_failed' }, 503);
  const { data: run, error: runLookupError } = await DB.from('hercules_shopify_bulk_reconciliation_runs')
    .select('id,status').eq('bulk_operation_gid', operationId).maybeSingle();
  if (runLookupError) return json({ error: 'run_lookup_failed' }, 503);
  if (!run) return json({ received: true, unmatched: true });
  if (String(payload.status).toUpperCase() !== 'COMPLETED' || String(payload.type).toUpperCase() !== 'QUERY') {
    const { error: failError } = await DB.from('hercules_shopify_bulk_reconciliation_runs').update({
      status: 'failed', error_code: String(payload.error_code || 'BULK_NOT_COMPLETED').slice(0, 80),
      error_message: 'Shopify bulk query did not complete successfully.'
    }).eq('id', run.id);
    if (failError) return json({ error: 'run_update_failed' }, 503);
    return json({ received: true, failed: true });
  }
  const { data: queued, error: queueError } = await DB.from('hercules_shopify_bulk_reconciliation_runs')
    .update({ status: 'queued' }).eq('id', run.id).eq('status', 'running').select('id').maybeSingle();
  if (queueError) return json({ error: 'queue_persist_failed' }, 503);
  if (!queued) return json({ received: true, alreadyQueuedOrProcessing: true });
  const task = processRun(run.id).catch(async () => {
    await DB.from('hercules_shopify_bulk_reconciliation_runs').update({
      status: 'failed', error_code: 'PROCESSING_FAILED',
      error_message: 'Bulk result processing failed; watermark was not advanced.'
    }).eq('id', run.id);
  });
  (globalThis as any).EdgeRuntime?.waitUntil?.(task);
  return json({ received: true, queued: true });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const raw = new Uint8Array(await req.arrayBuffer());
  if (req.headers.has('x-shopify-hmac-sha256')) {
    try { return await handleCompletion(req, raw); }
    catch { return json({ error: 'webhook_processing_unavailable' }, 503); }
  }
  let body: any;
  try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: 'invalid_json' }, 400); }
  const auth = await owner(req);
  if (!auth) return json({ error: 'owner_auth_required' }, 401);
  try {
    if (body.action === 'start_orders') {
      const org = String(body.organization_id || '');
      if (!auth.organizations.has(org)) return json({ error: 'organization_forbidden' }, 403);
      const mode = ['backfill','incremental','full'].includes(body.mode) ? body.mode : 'incremental';
      return json({ ok: true, ...(await startRun(org, mode)) }, 202);
    }
    if (body.action === 'resume') {
      const { data: run } = await DB.from('hercules_shopify_bulk_reconciliation_runs')
        .select('id,tenant_id,status').eq('id', String(body.run_id || '')).maybeSingle();
      if (!run || !auth.organizations.has(String(run.tenant_id))) return json({ error: 'run_not_found' }, 404);
      if (run.status === 'completed') return json({ ok: true, alreadyCompleted: true });
      if (['failed','processing','downloading'].includes(run.status)) {
        await DB.from('hercules_shopify_bulk_reconciliation_runs').update({ status: 'queued' }).eq('id', run.id).eq('status', run.status);
      } else if (run.status !== 'queued') {
        return json({ error: 'run_not_ready_to_resume' }, 409);
      }
      const result = await processRun(run.id);
      return json({ ok: true, ...result });
    }
    return json({ error: 'unsupported_action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'reconciliation_failed' }, 500);
  }
});
