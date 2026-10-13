import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const bulkSource = await readFile(new URL('../supabase/functions/hercules-shopify-bulk-reconciliation/index.ts', import.meta.url), 'utf8');
const webhookSource = await readFile(new URL('../supabase/functions/hercules-shopify-webhook/index.ts', import.meta.url), 'utf8');

function executable(source) {
  return stripTypeScriptTypes(source)
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export /gm, '')
    .replace(/if \(import\.meta\.main\) Deno\.serve\(handleBulkReconciliationRequest\);/, '');
}

function runtime({ modernKeys = false, rows = [] } = {}) {
  const environment = { SUPABASE_URL: 'https://example.supabase.co' };
  if (modernKeys) {
    environment.SUPABASE_SECRET_KEYS = JSON.stringify({ default: 'fixture-service-key' });
    environment.SUPABASE_PUBLISHABLE_KEYS = JSON.stringify({ default: 'fixture-public-key' });
  } else {
    environment.SUPABASE_SERVICE_ROLE_KEY = 'fixture-service-key';
    environment.SUPABASE_ANON_KEY = 'fixture-public-key';
  }
  const selectedColumns = [];
  const context = vm.createContext({
    URL, Request, Response, Headers, TextEncoder, TextDecoder, crypto,
    createClient(_url, key) {
      if (!key) throw new Error('supabaseKey is required');
      return {
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
        from() {
          let columns = '';
          const result = () => ({
            data: rows,
            error: columns.includes('client_secret_ref') ? { message: 'column client_secret_ref does not exist' } : null
          });
          const query = {
            select(value) { columns = value; selectedColumns.push(value); return query; },
            eq() { return query; },
            limit() { return query; },
            update() { return query; },
            maybeSingle: async () => ({ ...result(), data: rows[0] || null }),
            then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
          };
          return query;
        }
      };
    },
    Deno: {
      env: { get: name => environment[name] },
      serve: handler => { context.webhookHandler = handler; }
    }
  });
  vm.runInContext('(() => {\n' + executable(bulkSource) + '\nglobalThis.bulkHandler = handleBulkReconciliationRequest; globalThis.lookupConnection = connection;\n})();', context);
  context.handleBulkReconciliationRequest = context.bulkHandler;
  vm.runInContext('(() => {\n' + executable(webhookSource) + '\n})();', context);
  return { context, selectedColumns };
}

test('the actual webhook handler parses its route and reports missing native credentials', async () => {
  const { context } = runtime();
  const response = await context.webhookHandler(new Request('https://example.supabase.co/functions/v1/hercules-shopify-webhook'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, 'hercules-shopify-webhook');
  assert.equal(body.modes.native_hmac, false);
  assert.equal(body.secret_source, 'missing');
});

test('both modules boot with modern platform keys and retain the owner-authenticated bulk route', async () => {
  const { context } = runtime({ modernKeys: true });
  const response = await context.webhookHandler(new Request('https://example.supabase.co/functions/v1/hercules-shopify-webhook/bulk', {
    method: 'POST', body: JSON.stringify({ action: 'start_orders', organization_id: 'fixture-org' })
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'owner_auth_required' });
});

test('bulk credential lookup reads the provider table column used by the connection writer', async () => {
  const row = { organization_id: 'fixture-org', client_id: 'fixture-app', secret_ref: 'fixture-secret-ref', signing_secret_ref: 'fixture-signing-ref', status: 'active' };
  const { context, selectedColumns } = runtime({ rows: [row] });
  const connection = await context.lookupConnection('fixture-org');
  assert.equal(connection.secret_ref, row.secret_ref);
  assert.ok(selectedColumns.some(columns => columns.split(',').includes('secret_ref')));
});

test('an unsigned webhook cannot create paid access while native signing credentials are missing', async () => {
  const { context } = runtime();
  const response = await context.webhookHandler(new Request('https://example.supabase.co/functions/v1/hercules-shopify-webhook', {
    method: 'POST', body: '{}'
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'shopify_secret_not_configured' });
});
