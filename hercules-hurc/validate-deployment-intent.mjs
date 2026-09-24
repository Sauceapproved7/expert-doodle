import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function validateHurcDeploymentIntent(intent) {
  const errors = [];

  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    return {ok:false, errors:["deployment intent must be an object"]};
  }

  if (intent.schema !== "sauceapproved.hercules.hurc.deployment-intent") {
    errors.push("deployment intent schema mismatch");
  }

  if (intent.network !== "base-sepolia") {
    errors.push("HURC deployment readiness workflow is testnet-only: network must be base-sepolia");
  }

  if (Number(intent.chainId) !== 84532) {
    errors.push("HURC deployment readiness workflow is testnet-only: chainId must be 84532");
  }

  if (!ADDRESS.test(String(intent.treasuryAddress ?? ""))) {
    errors.push("treasuryAddress must be a 20-byte EVM address");
  } else if (/^0x0{40}$/i.test(intent.treasuryAddress)) {
    errors.push("treasuryAddress cannot be the zero address");
  }

  const supply = String(intent.initialSupplyWholeTokens ?? "");
  if (!/^[1-9][0-9]*$/.test(supply)) {
    errors.push("initialSupplyWholeTokens must be a positive whole-number string");
  } else {
    try {
      const amount = BigInt(supply);
      const scale = 10n ** 18n;
      const max = (2n ** 256n) - 1n;
      if (amount * scale > max) errors.push("initial supply exceeds uint256 after 18-decimal scaling");
    } catch {
      errors.push("initialSupplyWholeTokens is not a valid integer");
    }
  }

  if (intent.broadcast !== false) {
    errors.push("deployment intent committed to the repository must keep broadcast=false");
  }

  return {ok:errors.length === 0, errors};
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: node hercules-hurc/validate-deployment-intent.mjs <intent.json>");
  const intent = JSON.parse(await readFile(file, "utf8"));
  const result = validateHurcDeploymentIntent(intent);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
