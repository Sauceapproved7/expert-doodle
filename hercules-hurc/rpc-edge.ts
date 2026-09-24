import {BASE_SEPOLIA, probeBaseSepolia} from "./rpc-probe.mjs";

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

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return out({error:"method_not_allowed"}, 405);

  try {
    const result = await probeBaseSepolia(fetch);
    return out({
      ...result,
      service: "hercules-hurc-rpc",
      version: "1.0.0",
      expectedChainIdHex: BASE_SEPOLIA.chainIdHex,
    });
  } catch (error) {
    return out({
      ok: false,
      service: "hercules-hurc-rpc",
      network: BASE_SEPOLIA.id,
      expectedChainId: BASE_SEPOLIA.chainId,
      signerUsed: false,
      transactionBroadcast: false,
      error: error instanceof Error ? error.message : "rpc_probe_failed",
    }, 502);
  }
});
