import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  SHOPIFY_DNS_RECORDS,
  SpaceshipDnsClient,
  planShopifyDnsReconciliation,
} from "./spaceship-dns.mjs";

const U = Deno.env.get("SUPABASE_URL") || "";
const S =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const DOMAIN = "sauceapproved.com";
const ACTIONS = new Set(["inspect_shopify_dns", "reconcile_shopify_dns"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      "referrer-policy":"no-referrer",
    },
  });
}

function adminHeaders(extra: Record<string,string> = {}) {
  return {
    apikey:S,
    authorization:"Bearer " + S,
    ...extra,
  };
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function internalAuthorized(req: Request) {
  const key = req.headers.get("x-hercules-internal-key") || "";
  if (!key) return false;

  const url = new URL(U + "/rest/v1/hercules_internal_service_keys");
  url.searchParams.set("purpose", "eq.spaceship-dns");
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("select", "key_sha256,enabled");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {headers:adminHeaders()});
  if (!response.ok) return false;
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return Boolean(row?.enabled && row?.key_sha256 === await sha256(key));
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(U + "/rest/v1/" + path, {
    ...init,
    headers:adminHeaders({
      ...(init.headers as Record<string,string> || {}),
    }),
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = {raw:text.slice(0, 2000)}; }
  }
  if (!response.ok) throw new Error("supabase_rest_failed:" + response.status);
  return payload;
}

async function secret(secretRef: string) {
  const payload = await rest("rpc/hercules_get_secret", {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({p_id:secretRef}),
  });
  if (!payload) throw new Error("spaceship_credential_unavailable");
  return String(payload);
}

async function credentials() {
  const rows = await rest(
    "hercules_spaceship_dns_credentials?singleton=eq.true&status=eq.configured&select=api_key_secret_ref,api_secret_secret_ref&limit=1"
  ) as Array<{api_key_secret_ref?:string; api_secret_secret_ref?:string}>;

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.api_key_secret_ref || !row?.api_secret_secret_ref) {
    throw new Error("spaceship_credentials_not_configured");
  }

  const [apiKey, apiSecret] = await Promise.all([
    secret(row.api_key_secret_ref),
    secret(row.api_secret_secret_ref),
  ]);
  return {apiKey, apiSecret};
}

async function createRun(traceId: string, action: string, replaceCustomConflicts: boolean) {
  await rest("hercules_spaceship_dns_runs", {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      trace_id:traceId,
      action,
      status:"running",
      domain:DOMAIN,
      replace_custom_conflicts:replaceCustomConflicts,
    }),
  });
}

async function finishRun(traceId: string, status: string, summary: unknown, error: string | null = null) {
  const query = new URLSearchParams({trace_id:"eq." + traceId});
  await rest("hercules_spaceship_dns_runs?" + query, {
    method:"PATCH",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      status,
      summary,
      error,
      completed_at:new Date().toISOString(),
    }),
  });
}

function managedRecord(record: Record<string,unknown>) {
  const type = String(record?.type || "").toUpperCase();
  const groupRaw = record?.group as Record<string,unknown> | string | undefined;
  const group = groupRaw && typeof groupRaw === "object"
    ? String(groupRaw.type || "unknown")
    : String(groupRaw || "unknown");
  const value = type === "CNAME"
    ? String(record?.cname || "")
    : String(record?.address || "");
  return {type, name:String(record?.name || ""), value, group};
}

function planSummary(plan: ReturnType<typeof planShopifyDnsReconciliation>, current: Record<string,unknown>[]) {
  const managedKeys = new Set(["A:@", "AAAA:@", "CNAME:www"]);
  return {
    domain:DOMAIN,
    ready:plan.ready,
    safeToApply:plan.safeToApply,
    desired:SHOPIFY_DNS_RECORDS,
    currentManaged:current
      .filter((record) => managedKeys.has(String(record.type || "").toUpperCase() + ":" + String(record.name || "").toLowerCase()))
      .map(managedRecord),
    customConflictCount:plan.deleteRecords.length,
    blockingConflicts:plan.blockingConflicts,
    missingCount:plan.saveRecords.length,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({
      ok:true,
      service:"hercules-spaceship-dns",
      version:"1.0.0",
      domain:DOMAIN,
      actions:Array.from(ACTIONS),
      rawCredentialExposure:false,
    });
  }

  if (req.method !== "POST") return json({error:"method_not_allowed"}, 405);
  if (!U || !S) return json({error:"runtime_configuration_missing"}, 503);
  if (!await internalAuthorized(req)) return json({error:"unauthorized"}, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  if (!ACTIONS.has(action)) return json({error:"unsupported_action"}, 400);

  const replaceCustomConflicts = body?.replaceCustomConflicts === true;
  if (action === "inspect_shopify_dns" && replaceCustomConflicts) {
    return json({error:"replace_flag_not_allowed_for_inspect"}, 400);
  }

  const traceId = crypto.randomUUID();
  await createRun(traceId, action, replaceCustomConflicts);

  try {
    const {apiKey, apiSecret} = await credentials();
    const client = new SpaceshipDnsClient({
      apiKey,
      apiSecret,
      allowedDomains:[DOMAIN],
      fetchImpl:fetch,
    });

    if (action === "inspect_shopify_dns") {
      const current = await client.listRecords(DOMAIN);
      const plan = planShopifyDnsReconciliation(current.items);
      const summary = planSummary(plan, current.items);
      await finishRun(traceId, plan.blockingConflicts.length ? "conflict" : "succeeded", summary);
      return json({ok:true, traceId, action, summary});
    }

    const current = await client.listRecords(DOMAIN);
    const preflight = planShopifyDnsReconciliation(current.items);
    const before = planSummary(preflight, current.items);

    if (preflight.blockingConflicts.length) {
      await finishRun(traceId, "conflict", before, "provider_managed_or_unknown_conflict");
      return json({ok:false, traceId, error:"dns_conflict", summary:before}, 409);
    }

    if (preflight.deleteRecords.length && !replaceCustomConflicts) {
      await finishRun(traceId, "conflict", before, "custom_conflict_requires_explicit_replacement");
      return json({ok:false, traceId, error:"custom_conflict_requires_explicit_replacement", summary:before}, 409);
    }

    const result = await client.reconcileShopify(DOMAIN, {replaceCustomConflicts});
    const after = await client.listRecords(DOMAIN);
    const verification = planShopifyDnsReconciliation(after.items);
    const summary = {
      ...planSummary(verification, after.items),
      changed:result.changed,
      deletedCount:result.deleted?.length || 0,
      savedCount:result.saved?.length || 0,
      verified:result.verified === true && verification.ready,
    };

    if (!summary.verified) throw new Error("spaceship_dns_post_write_verification_failed");

    await finishRun(traceId, "succeeded", summary);
    return json({ok:true, traceId, action, summary});
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 1000) : "spaceship_dns_failed";
    const status = detail === "spaceship_credentials_not_configured" ? 503 : 502;
    await finishRun(traceId, "failed", {domain:DOMAIN}, detail).catch(() => {});
    return json({ok:false, traceId, error:detail}, status);
  }
});
