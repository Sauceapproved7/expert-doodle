import {readFile} from "node:fs/promises";

const manifestUrl = new URL("../hercules-hurc/deployment.json", import.meta.url);

export function validateHurcDeployment(manifest) {
  const errors = [];
  const deployment = manifest?.deployment ?? {};
  if (manifest?.schema !== "sauceapproved.hercules.hurc-deployment") errors.push("invalid HURC deployment schema");
  if (manifest?.name !== "Hercules Coin") errors.push("unexpected token name");
  if (manifest?.symbol !== "HURC") errors.push("unexpected token symbol");
  if (manifest?.decimals !== 18) errors.push("HURC decimals must remain 18");
  if (manifest?.supplyModel !== "fixed-at-deployment") errors.push("HURC supply model must remain fixed-at-deployment");
  if (manifest?.postDeploymentMinting !== false) errors.push("post-deployment minting must remain disabled");
  if (manifest?.upgradeable !== false) errors.push("HURC must remain non-upgradeable");
  if (manifest?.adminRole !== false) errors.push("HURC must remain without an admin role");

  const status = deployment.status;
  if (!["not-deployed", "deployment-approved", "deployed"].includes(status)) errors.push("unsupported deployment status");

  if (status === "not-deployed") {
    for (const field of ["chainId", "contractAddress", "treasuryAddress", "initialSupplyWholeTokens", "transactionHash", "sourceCommit"]) {
      if (deployment[field] !== null) errors.push(field + " must remain null before deployment approval");
    }
  }

  if (status === "deployment-approved" || status === "deployed") {
    if (!Number.isSafeInteger(deployment.chainId) || deployment.chainId <= 0) errors.push("chainId must be a positive safe integer");
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(deployment.treasuryAddress ?? ""))) errors.push("treasuryAddress must be an EVM address");
    if (!Number.isSafeInteger(deployment.initialSupplyWholeTokens) || deployment.initialSupplyWholeTokens <= 0) errors.push("initialSupplyWholeTokens must be a positive safe integer");
    if (!/^[0-9a-f]{40}$/i.test(String(deployment.sourceCommit ?? ""))) errors.push("sourceCommit must be a full Git commit SHA");
  }

  if (status === "deployment-approved") {
    if (deployment.contractAddress !== null) errors.push("contractAddress must remain null until deployment");
    if (deployment.transactionHash !== null) errors.push("transactionHash must remain null until deployment");
  }

  if (status === "deployed") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(deployment.contractAddress ?? ""))) errors.push("contractAddress must be an EVM address");
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(deployment.transactionHash ?? ""))) errors.push("transactionHash must be a transaction hash");
  }
  return {ok: errors.length === 0, errors};
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  const result = validateHurcDeployment(manifest);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
