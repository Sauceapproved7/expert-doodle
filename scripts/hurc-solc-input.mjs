import {readFile} from "node:fs/promises";

const source = await readFile(
  new URL("../hercules-hurc/HURC.sol", import.meta.url),
  "utf8",
);

const input = {
  language: "Solidity",
  sources: {
    "hercules-hurc/HURC.sol": {
      content: source,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    viaIR: false,
    evmVersion: "shanghai",
    outputSelection: {
      "*": {
        "*": [
          "abi",
          "metadata",
          "evm.bytecode.object",
          "evm.deployedBytecode.object"
        ]
      }
    }
  }
};

process.stdout.write(JSON.stringify(input));
