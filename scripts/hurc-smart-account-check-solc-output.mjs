import {readFile} from "node:fs/promises";

const outputPath = process.argv[2];
if (!outputPath) {
  console.error("usage: node scripts/hurc-smart-account-check-solc-output.mjs <solc-output.json>");
  process.exit(2);
}

const output = JSON.parse(await readFile(outputPath, "utf8"));
const compilerErrors = (output.errors ?? []).filter((entry) => entry.severity === "error");
if (compilerErrors.length) {
  for (const entry of compilerErrors) {
    console.error(entry.formattedMessage || entry.message);
  }
  process.exit(1);
}

const sourceKey = "hercules-hurc/HerculesSmartAccount.sol";
const contracts = output.contracts?.[sourceKey] ?? {};
const account = contracts.HerculesSmartAccount;
const factory = contracts.HerculesSmartAccountFactory;

if (!account) throw new Error("compiled HerculesSmartAccount missing");
if (!factory) throw new Error("compiled HerculesSmartAccountFactory missing");

function functionNames(abi) {
  return new Set(
    (abi ?? [])
      .filter((entry) => entry.type === "function")
      .map((entry) => entry.name),
  );
}

const accountFunctions = functionNames(account.abi);
for (const required of [
  "validateUserOp",
  "execute",
  "executeBatch",
  "getNonce",
  "addDeposit",
  "withdrawDepositTo",
]) {
  if (!accountFunctions.has(required)) {
    throw new Error("smart account ABI missing " + required);
  }
}

const factoryFunctions = functionNames(factory.abi);
for (const required of ["createAccount", "getAddress"]) {
  if (!factoryFunctions.has(required)) {
    throw new Error("smart account factory ABI missing " + required);
  }
}

for (const [name, contract] of Object.entries({
  HerculesSmartAccount: account,
  HerculesSmartAccountFactory: factory,
})) {
  const creation = contract.evm?.bytecode?.object ?? "";
  const runtime = contract.evm?.deployedBytecode?.object ?? "";
  if (!creation) throw new Error(name + " creation bytecode is empty");
  if (!runtime) throw new Error(name + " runtime bytecode is empty");
}

console.log(JSON.stringify({
  ok: true,
  source: sourceKey,
  contracts: {
    HerculesSmartAccount: {
      abiEntries: account.abi.length,
      creationBytes: account.evm.bytecode.object.length / 2,
      runtimeBytes: account.evm.deployedBytecode.object.length / 2,
    },
    HerculesSmartAccountFactory: {
      abiEntries: factory.abi.length,
      creationBytes: factory.evm.bytecode.object.length / 2,
      runtimeBytes: factory.evm.deployedBytecode.object.length / 2,
    },
  },
}, null, 2));
