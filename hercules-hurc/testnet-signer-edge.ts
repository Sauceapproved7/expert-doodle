import {
  bytesToHex,
  generatePrivateKey,
  privateKeyToAddress,
} from "./testnet-crypto.mjs";

const U = Deno.env.get("SUPABASE_URL") || "";
const SERVICE =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

function out(body: unknown, status = 200) {
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

function headers(extra: Record<string,string> = {}) {
  return {
    apikey: SERVICE,
    authorization: "Bearer " + SERVICE,
    ...extra,
  };
}

async function existingSigner() {
  const url = new URL(U + "/rest/v1/hercules_hurc_test_signers");
  url.searchParams.set("network", "eq.base-sepolia");
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("select", "id,address,network,chain_id,status,created_at");
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {headers: headers()});
  if (!response.ok) throw new Error("signer_registry_read_failed");

  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function storeSecret(privateKeyHex: string, address: string) {
  const response = await fetch(U + "/rest/v1/rpc/hercules_store_secret", {
    method: "POST",
    headers: headers({"content-type":"application/json"}),
    body: JSON.stringify({
      p_value: privateKeyHex,
      p_name: "hurc-base-sepolia-" + address.slice(2),
      p_description: "HURC Base Sepolia test signer. Testnet only.",
    }),
  });

  if (!response.ok) throw new Error("signer_vault_write_failed");

  const payload = await response.json();
  const secretRef =
    typeof payload === "string"
      ? payload
      : typeof payload?.id === "string"
        ? payload.id
        : null;

  if (!secretRef) throw new Error("signer_vault_reference_missing");
  return secretRef;
}

async function insertSigner(address: string, secretRef: string) {
  const response = await fetch(U + "/rest/v1/hercules_hurc_test_signers", {
    method: "POST",
    headers: headers({
      "content-type":"application/json",
      "prefer":"return=representation",
    }),
    body: JSON.stringify({
      network: "base-sepolia",
      chain_id: 84532,
      address,
      secret_ref: secretRef,
      status: "active",
      metadata: {
        purpose: "hurc-test-deployment",
        private_key_returned: false,
        mainnet_enabled: false,
      },
    }),
  });

  if (!response.ok) throw new Error("signer_registry_write_failed");
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function prepareSigner() {
  const existing = await existingSigner();
  if (existing) {
    return {
      ok: true,
      prepared: true,
      reused: true,
      signer: existing,
      privateKeyReturned: false,
      mainnetEnabled: false,
    };
  }

  const privateKey = generatePrivateKey();
  const address = privateKeyToAddress(privateKey);
  const secretRef = await storeSecret(bytesToHex(privateKey), address);
  const signer = await insertSigner(address, secretRef);

  privateKey.fill(0);

  return {
    ok: true,
    prepared: true,
    reused: false,
    signer: {
      id: signer.id,
      address: signer.address,
      network: signer.network,
      chain_id: signer.chain_id,
      status: signer.status,
      created_at: signer.created_at,
    },
    privateKeyReturned: false,
    mainnetEnabled: false,
  };
}

Deno.serve(async (req: Request) => {
  if (!U || !SERVICE) return out({error:"runtime_configuration_missing"}, 503);

  if (req.method === "GET") {
    try {
      const signer = await existingSigner();
      return out({
        ok: true,
        service: "hercules-hurc-test-signer",
        version: "1.0.0",
        network: "base-sepolia",
        chainId: 84532,
        prepared: Boolean(signer),
        signer: signer
          ? {
              id: signer.id,
              address: signer.address,
              status: signer.status,
              created_at: signer.created_at,
            }
          : null,
        privateKeyReturned: false,
        mainnetEnabled: false,
      });
    } catch (error) {
      return out({
        ok: false,
        error: error instanceof Error ? error.message : "signer_status_failed",
      }, 500);
    }
  }

  if (req.method !== "POST") return out({error:"method_not_allowed"}, 405);

  const body = await req.json().catch(() => ({}));
  if (String(body?.action || "") !== "prepare") {
    return out({error:"unsupported_action"}, 400);
  }

  try {
    return out(await prepareSigner());
  } catch (error) {
    return out({
      ok: false,
      error: error instanceof Error ? error.message : "signer_prepare_failed",
      privateKeyReturned: false,
      mainnetEnabled: false,
    }, 500);
  }
});
