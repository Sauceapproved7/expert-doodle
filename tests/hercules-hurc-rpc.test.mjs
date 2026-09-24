import test from "node:test";
import assert from "node:assert/strict";
import {BASE_SEPOLIA, probeBaseSepolia} from "../hercules-hurc/rpc-probe.mjs";

test("Base Sepolia network identity is pinned", () => {
  assert.equal(BASE_SEPOLIA.chainId, 84532);
  assert.equal(BASE_SEPOLIA.chainIdHex, "0x14a34");
  assert.equal(BASE_SEPOLIA.rpcUrl, "https://sepolia.base.org");
  assert.equal(BASE_SEPOLIA.production, false);
});

test("probe accepts the expected chain and returns read-only network data", async () => {
  const results = new Map([
    ["eth_chainId", "0x14a34"],
    ["eth_blockNumber", "0x1234"],
    ["eth_gasPrice", "0x3b9aca00"],
  ]);
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      async json() { return {jsonrpc:"2.0", id:1, result:results.get(body.method)}; },
    };
  };

  const result = await probeBaseSepolia(fetchImpl);
  assert.equal(result.ok, true);
  assert.equal(result.chainId, 84532);
  assert.equal(result.blockNumber, 0x1234);
  assert.equal(result.gasPriceWei, "1000000000");
  assert.equal(result.signerUsed, false);
  assert.equal(result.transactionBroadcast, false);
});

test("probe fails closed on a chain-id mismatch", async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    const result = body.method === "eth_chainId" ? "0x1" : "0x1";
    return {ok:true, async json(){return {jsonrpc:"2.0", id:1, result};}};
  };
  await assert.rejects(() => probeBaseSepolia(fetchImpl), /chain_id_mismatch/);
});
