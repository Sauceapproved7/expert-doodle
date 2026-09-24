export const HURC_TEST_NETWORKS = Object.freeze({
  "base-sepolia": Object.freeze({
    id: "base-sepolia",
    displayName: "Base Sepolia",
    chainId: 84532,
    production: false,
    nativeCurrency: "ETH",
  }),
  "ethereum-sepolia": Object.freeze({
    id: "ethereum-sepolia",
    displayName: "Ethereum Sepolia",
    chainId: 11155111,
    production: false,
    nativeCurrency: "ETH",
  }),
});

export function getHurcTestNetwork(id) {
  const network = HURC_TEST_NETWORKS[id];
  if (!network) {
    throw new Error("unsupported HURC test network: " + String(id));
  }
  if (network.production !== false) {
    throw new Error("HURC deployment planner refuses production networks");
  }
  return network;
}
