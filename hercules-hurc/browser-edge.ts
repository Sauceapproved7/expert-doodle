const U = Deno.env.get("SUPABASE_URL") || "";
const SERVICE =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const BASE_FUNDS_URL = "https://docs.base.org/get-started/get-funds";
const QUICKNODE_FAUCET_URL = "https://faucet.quicknode.com/base/sepolia";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function adminHeaders(extra: Record<string,string> = {}) {
  return {
    apikey: SERVICE,
    authorization: "Bearer " + SERVICE,
    ...extra,
  };
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function serviceKeyRow() {
  const url = new URL(U + "/rest/v1/hercules_internal_service_keys");
  url.searchParams.set("purpose", "eq.browser-gateway");
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("select", "key_sha256,secret_ref,enabled");
  url.searchParams.set("limit", "1");
  const r = await fetch(url, { headers: adminHeaders() });
  if (!r.ok) throw new Error("browser_gateway_registry_unavailable");
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.enabled || !row?.key_sha256 || !row?.secret_ref) {
    throw new Error("browser_gateway_registry_missing");
  }
  return row;
}

async function authorized(req: Request) {
  const key = req.headers.get("x-hercules-internal-key") || "";
  if (!key) return false;
  const row = await serviceKeyRow();
  return row.key_sha256 === await sha256(key);
}

async function browserSecret() {
  const row = await serviceKeyRow();
  const r = await fetch(U + "/rest/v1/rpc/hercules_get_secret", {
    method: "POST",
    headers: adminHeaders({"content-type": "application/json"}),
    body: JSON.stringify({ p_id: row.secret_ref }),
  });
  if (!r.ok) throw new Error("browser_gateway_secret_unavailable");
  const secret = await r.json();
  if (!secret) throw new Error("browser_gateway_secret_unavailable");
  return String(secret);
}

async function activeTestSigner() {
  const url = new URL(U + "/rest/v1/hercules_hurc_test_signers");
  url.searchParams.set("network", "eq.base-sepolia");
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("select", "address,network,chain_id,status");
  url.searchParams.set("limit", "1");
  const r = await fetch(url, {headers: adminHeaders()});
  if (!r.ok) throw new Error("hurc_test_signer_read_failed");
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  const address = String(row?.address || "").toLowerCase();
  if (
    row?.network !== "base-sepolia" ||
    Number(row?.chain_id) !== 84532 ||
    row?.status !== "active" ||
    !/^0x[0-9a-f]{40}$/.test(address) ||
    address === "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error("hurc_test_signer_unavailable");
  }
  return {address, network:"base-sepolia", chainId:84532, status:"active"};
}

async function callBrowser(request: Record<string, unknown>) {
  const internalKey = await browserSecret();
  const r = await fetch(U + "/functions/v1/hercules-browser", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hercules-internal-key": internalKey,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(40000),
  });
  const text = await r.text();
  let payload: unknown;
  try { payload = JSON.parse(text); }
  catch { payload = { raw: text.slice(0, 2000) }; }
  if (!r.ok) throw new Error("hercules_browser_failed:" + r.status);
  return payload;
}

async function discoverFaucets() {
  const payload = await callBrowser({
    action: "scrape",
    url: BASE_FUNDS_URL,
    timeoutMs: 30000,
    maxTextChars: 30000,
    steps: [],
  });
  return json({
    ok: true,
    service: "hercules-hurc-browser",
    network: "base-sepolia",
    source: "hercules-browser",
    fundsPage: BASE_FUNDS_URL,
    browserResult: payload,
    privateKeyStored: false,
    transactionBroadcast: false,
  });
}

async function prepareQuickNode() {
  const signer = await activeTestSigner();
  const payload = await callBrowser({
    action: "interact",
    url: QUICKNODE_FAUCET_URL,
    timeoutMs: 30000,
    maxTextChars: 30000,
    steps: [
      {type:"type", selector:"#wallet", text:signer.address},
      {type:"click", selector:'button[name="_action"][value="step-one"]'},
      {type:"wait", ms:1500},
    ],
  });
  return json({
    ok: true,
    service: "hercules-hurc-browser",
    action: "prepare_quicknode",
    network: signer.network,
    chainId: signer.chainId,
    signerAddress: signer.address,
    source: "hercules-browser",
    faucet: QUICKNODE_FAUCET_URL,
    browserResult: payload,
    privateKeyStored: false,
    privateKeyReturned: false,
    transactionBroadcast: false,
    antiBotBypassed: false,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({
      ok: true,
      service: "hercules-hurc-browser",
      version: "1.1.0",
      network: "base-sepolia",
      chainId: 84532,
      browserGateway: "hercules-browser",
      fundsPage: BASE_FUNDS_URL,
      faucet: QUICKNODE_FAUCET_URL,
      actions: ["discover_faucets", "prepare_quicknode"],
      privateKeyStored: false,
      transactionBroadcast: false,
      antiBotBypassed: false,
    });
  }
  if (req.method !== "POST") return json({error:"method_not_allowed"},405);
  if (!SERVICE || !U) return json({error:"runtime_configuration_missing"},503);

  let ok = false;
  try { ok = await authorized(req); }
  catch { return json({error:"authorization_registry_unavailable"},503); }
  if (!ok) return json({error:"internal_authorization_required"},403);

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  try {
    if (action === "discover_faucets") return await discoverFaucets();
    if (action === "prepare_quicknode") return await prepareQuickNode();
  } catch (error) {
    return json({
      ok:false,
      action,
      error:error instanceof Error ? error.message : "hurc_browser_failed",
      privateKeyReturned:false,
      transactionBroadcast:false,
      antiBotBypassed:false,
    }, 502);
  }
  return json({error:"unsupported_action"},400);
});
