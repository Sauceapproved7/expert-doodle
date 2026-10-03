import {readFile} from "node:fs/promises";

const policy = JSON.parse(
  await readFile(
    new URL("../hercules-hurc/compiler-policy.json", import.meta.url),
    "utf8",
  ),
);

const source = await readFile(
  new URL("../hercules-hurc/HerculesSmartAccount.sol", import.meta.url),
  "utf8",
);

const input = {
  language: "Solidity",
  sources: {
    "hercules-hurc/HerculesSmartAccount.sol": {
      content: source,
    },
  },
  settings: {
    optimizer: policy.optimizer,
    evmVersion: policy.evmVersion,
    viaIR: policy.viaIR,
    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
        ],
      },
    },
  },
};

process.stdout.write(JSON.stringify(input));
