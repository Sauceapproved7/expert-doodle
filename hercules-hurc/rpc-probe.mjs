export const BASE_SEPOLIA = Object.freeze({
  id: "base-sepolia",
  chainId: 84532,
  chainIdHex: "0x14a34",
  rpcUrl: "https://sepolia.base.org",
  production: false,
});

async function rpc(fetchImpl, method, params = []) {
  const response = await fetchImpl(BASE_SEPOLIA.rpcUrl, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({jsonrpc:"2.0", id:1, method, params}),
  });
  const payload = await response.json();
  if (!response.ok || payload?.error) {
    throw new Error("base_sepolia_rpc_failed:" + method);
  }
  return payload?.result;
}

export async function probeBaseSepolia(fetchImpl = fetch) {
  const [chainIdHex, blockNumberHex, gasPriceHex] = await Promise.all([
    rpc(fetchImpl, "eth_chainId"),
    rpc(fetchImpl, "eth_blockNumber"),
    rpc(fetchImpl, "eth_gasPrice"),
  ]);

  if (String(chainIdHex).toLowerCase() !== BASE_SEPOLIA.chainIdHex) {
    throw new Error("base_sepolia_chain_id_mismatch");
  }

  const blockNumber = Number.parseInt(String(blockNumberHex), 16);
  const gasPriceWei = BigInt(String(gasPriceHex));

  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) {
    throw new Error("base_sepolia_block_number_invalid");
  }
  if (gasPriceWei < 0n) {
    throw new Error("base_sepolia_gas_price_invalid");
  }

  return {
    ok: true,
    network: BASE_SEPOLIA.id,
    chainId: BASE_SEPOLIA.chainId,
    rpcUrl: BASE_SEPOLIA.rpcUrl,
    blockNumber,
    gasPriceWei: gasPriceWei.toString(),
    production: false,
    signerUsed: false,
    transactionBroadcast: false,
  };
}
