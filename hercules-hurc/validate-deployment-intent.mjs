import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const ZERO = /^0x0{40}$/i;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function validateDeploymentIntent(intent) {
  const errors = [];
  if (intent?.schema !== "sauceapproved.hercules.hurc-deployment-intent") errors.push("invalid schema");
  if (intent?.version !== 1) errors.push("unsupported version");
  if (intent?.token?.name !== "Hercules Coin" || intent?.token?.symbol !== "HURC") errors.push("token identity mismatch");
  if (intent?.source !== "hercules-hurc/HURC.sol") errors.push("canonical source mismatch");
  if (intent?.network?.environment !== "testnet") errors.push("only testnet deployment intents are allowed by this gate");
  if (!Number.isSafeInteger(intent?.network?.chainId) || intent.network.chainId <= 0) errors.push("chainId must be a positive safe integer");
  if (!ADDRESS.test(intent?.treasuryAddress ?? "") || ZERO.test(intent.treasuryAddress)) errors.push("treasuryAddress must be a non-zero EVM address");
  if (!Number.isSafeInteger(intent?.initialSupplyWholeTokens) || intent.initialSupplyWholeTokens <= 0) errors.push("initialSupplyWholeTokens must be a positive safe integer");
  if (intent?.privateKey !== undefined || intent?.seedPhrase !== undefined || intent?.mnemonic !== undefined) errors.push("wallet secrets must never be stored in deployment intent");
  if (intent?.authorization?.mainnetApproved === true) errors.push("testnet intent cannot authorize mainnet");
  return {ok: errors.length === 0, errors};
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: node hercules-hurc/validate-deployment-intent.mjs <intent.json>");
  const intent = JSON.parse(await readFile(path, "utf8"));
  const result = validateDeploymentIntent(intent);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
