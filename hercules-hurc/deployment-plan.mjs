import {getHurcTestNetwork} from "./networks.mjs";

const DECIMALS = 18n;
const SCALE = 10n ** DECIMALS;
const UINT256_MAX = (1n << 256n) - 1n;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_RE = /^0x(?:[0-9a-fA-F]{2})*$/;

function requireAddress(value) {
  if (typeof value !== "string" || !ADDRESS_RE.test(value)) {
    throw new Error("treasuryAddress must be a 20-byte 0x-prefixed EVM address");
  }
  if (/^0x0{40}$/i.test(value)) {
    throw new Error("treasuryAddress cannot be the zero address");
  }
  return value;
}

function requireWholeTokenSupply(value) {
  const raw = typeof value === "bigint" ? value.toString() : String(value ?? "");
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error("initialSupplyWholeTokens must be a positive whole-number string");
  }

  const whole = BigInt(raw);
  if (whole > UINT256_MAX / SCALE) {
    throw new Error("initialSupplyWholeTokens exceeds uint256 capacity at 18 decimals");
  }
  return whole;
}

function addressWord(address) {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function uintWord(value) {
  return value.toString(16).padStart(64, "0");
}

function normalizeBytecode(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !HEX_RE.test(value) || value.length <= 2) {
    throw new Error("compilerBytecode must be non-empty 0x-prefixed even-length hex");
  }
  return value.toLowerCase();
}

export function buildHurcDeploymentPlan(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("deployment request must be an object");
  }

  const network = getHurcTestNetwork(request.network);
  const treasuryAddress = requireAddress(request.treasuryAddress);
  const wholeSupply = requireWholeTokenSupply(request.initialSupplyWholeTokens);
  const bytecode = normalizeBytecode(request.compilerBytecode);

  const baseUnits = wholeSupply * SCALE;
  const constructorArgsHex =
    "0x" + addressWord(treasuryAddress) + uintWord(wholeSupply);

  const unsignedDeploymentData = bytecode
    ? bytecode + constructorArgsHex.slice(2)
    : null;

  return {
    schema: "sauceapproved.hercules.hurc-deployment-plan",
    version: 1,
    token: {
      name: "Hercules Coin",
      symbol: "HURC",
      decimals: Number(DECIMALS),
      supplyModel: "fixed-at-deployment",
      postDeploymentMinting: false,
    },
    network,
    treasuryAddress,
    initialSupplyWholeTokens: wholeSupply.toString(),
    initialSupplyBaseUnits: baseUnits.toString(),
    constructorArgsHex,
    compilerBytecodePresent: Boolean(bytecode),
    unsignedDeploymentData,
    broadcast: false,
    signing: {
      privateKeyStoredByHercules: false,
      requiredExternalAuthorization: true,
    },
    remainingExternalInputs: [
      ...(bytecode ? [] : ["compiled HURC creation bytecode"]),
      "authorized wallet signature",
      "RPC endpoint for the selected test network",
      "testnet ETH for gas",
    ],
  };
}
