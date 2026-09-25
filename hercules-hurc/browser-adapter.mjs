export const HURC_BASE_FUNDS_URL = "https://docs.base.org/get-started/get-funds";
export const HURC_QUICKNODE_FAUCET_URL = "https://faucet.quicknode.com/base/sepolia";

function normalizeTestSignerAddress(address) {
  const value = String(address || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(value)) {
    throw new Error("invalid HURC test signer address");
  }
  if (value === "0x0000000000000000000000000000000000000000") {
    throw new Error("zero HURC test signer address");
  }
  return value;
}

export function buildHurcFaucetStepOneRequest(address) {
  const signer = normalizeTestSignerAddress(address);
  return {
    action: "interact",
    url: HURC_QUICKNODE_FAUCET_URL,
    timeoutMs: 30000,
    maxTextChars: 30000,
    steps: [
      {type:"type", selector:"#wallet", text:signer},
      {type:"click", selector:'button[name="_action"][value="step-one"]'},
      {type:"wait", ms:1500},
    ],
  };
}

export function buildHurcBrowserRequest(input = {}) {
  const action = String(input.action || "discover_faucets");
  if (action === "prepare_quicknode") {
    return buildHurcFaucetStepOneRequest(input.address);
  }
  if (action !== "discover_faucets") {
    throw new Error("unsupported HURC browser action");
  }

  return {
    action: "scrape",
    url: HURC_BASE_FUNDS_URL,
    timeoutMs: 30000,
    maxTextChars: 30000,
    steps: [],
  };
}

export async function callHerculesBrowser(fetchImpl, {
  supabaseUrl,
  internalKey,
  request = buildHurcBrowserRequest(),
}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch implementation required");
  if (!/^https:\/\//.test(String(supabaseUrl || ""))) throw new Error("valid Supabase URL required");
  if (!internalKey) throw new Error("Hercules browser internal key required");

  const response = await fetchImpl(
    String(supabaseUrl).replace(/\/$/, "") + "/functions/v1/hercules-browser",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hercules-internal-key": String(internalKey),
      },
      body: JSON.stringify(request),
    },
  );

  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { payload = { raw: text.slice(0, 2000) }; }

  if (!response.ok || payload?.ok === false) {
    throw new Error("Hercules browser request failed: " + response.status);
  }
  return payload;
}
