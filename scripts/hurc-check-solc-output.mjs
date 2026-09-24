import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const outputPath = process.argv[2];
if (!outputPath) {
  console.error("usage: node scripts/hurc-check-solc-output.mjs <solc-output.json>");
  process.exit(2);
}

const output = JSON.parse(await readFile(outputPath, "utf8"));
const errors = Array.isArray(output.errors) ? output.errors : [];
const fatal = errors.filter((item) => item.severity === "error");

if (fatal.length > 0) {
  for (const item of fatal) {
    console.error(item.formattedMessage || item.message || JSON.stringify(item));
  }
  process.exit(1);
}

const contract = output.contracts?.["hercules-hurc/HURC.sol"]?.HURC;
if (!contract) {
  throw new Error("solc output does not contain hercules-hurc/HURC.sol:HURC");
}

const creationBytecode = contract.evm?.bytecode?.object;
const deployedBytecode = contract.evm?.deployedBytecode?.object;
if (!creationBytecode || !/^[0-9a-fA-F]+$/.test(creationBytecode)) {
  throw new Error("HURC creation bytecode is missing or malformed");
}
if (!deployedBytecode || !/^[0-9a-fA-F]+$/.test(deployedBytecode)) {
  throw new Error("HURC deployed bytecode is missing or malformed");
}

const abi = Array.isArray(contract.abi) ? contract.abi : [];
const functions = new Set(
  abi
    .filter((item) => item.type === "function")
    .map((item) => item.name),
);

for (const name of [
  "allowance",
  "approve",
  "balanceOf",
  "decimals",
  "name",
  "symbol",
  "totalSupply",
  "transfer",
  "transferFrom",
]) {
  if (!functions.has(name)) {
    throw new Error("compiled HURC ABI missing function: " + name);
  }
}

const bytecodeBytes = creationBytecode.length / 2;
const deployedBytes = deployedBytecode.length / 2;
const creationSha256 = createHash("sha256")
  .update(Buffer.from(creationBytecode, "hex"))
  .digest("hex");

console.log(JSON.stringify({
  schema: "sauceapproved.hercules.hurc-compile-evidence",
  version: 1,
  contract: "HURC",
  warnings: errors.filter((item) => item.severity === "warning").length,
  creationBytecodeBytes: bytecodeBytes,
  deployedBytecodeBytes: deployedBytes,
  creationBytecodeSha256: creationSha256,
  abiEntries: abi.length,
  ok: true,
}, null, 2));
