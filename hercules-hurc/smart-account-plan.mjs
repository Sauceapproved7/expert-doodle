import {getHurcTestNetwork} from "./networks.mjs";
import {keccak256, bytesToHex} from "./testnet-crypto.mjs";

export const ERC4337_ENTRYPOINT_V08 =
  "0x4337084d9e255ff0702461cf8895ce9e3b5ff108";

export const HERCULES_SMART_ACCOUNT_SCHEMA =
  "sauceapproved.hercules.smart-account-plan";

const SECRET_KEY_RE =
  /(private.?key|mnemonic|seed|recovery.?phrase|secret|password)/i;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function assertNoSecrets(value, path = "input") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) {
      throw new Error("secret-bearing field rejected: " + path + "." + key);
    }
    if (child && typeof child === "object") {
      assertNoSecrets(child, path + "." + key);
    }
  }
}

function normalizeAddress(value, label) {
  const address = String(value || "").toLowerCase();
  if (!ADDRESS_RE.test(address) || /^0x0{40}$/.test(address)) {
    throw new Error("invalid " + label);
  }
  return address;
}

function normalizeSalt(value) {
  const salt = BigInt(value ?? 0);
  if (salt < 0n || salt > (1n << 256n) - 1n) {
    throw new Error("invalid smart-account salt");
  }
  return salt;
}

function wordHex(value) {
  return BigInt(value).toString(16).padStart(64, "0");
}

function addressWord(value) {
  return normalizeAddress(value, "address").slice(2).padStart(64, "0");
}

function selector(signature) {
  return bytesToHex(
    keccak256(new TextEncoder().encode(signature)).slice(0, 4),
  ).slice(2);
}

export function encodeCreateAccountCall(ownerAddress, salt = 0n) {
  return "0x"
    + selector("createAccount(address,uint256)")
    + addressWord(ownerAddress)
    + wordHex(normalizeSalt(salt));
}

export function buildSmartAccountPlan(input = {}) {
  assertNoSecrets(input);

  const network = getHurcTestNetwork(input.network);
  const ownerAddress = normalizeAddress(input.ownerAddress, "owner address");
  const salt = normalizeSalt(input.salt);
  const factoryAddress =
    input.factoryAddress == null
      ? null
      : normalizeAddress(input.factoryAddress, "factory address");

  return Object.freeze({
    schema: HERCULES_SMART_ACCOUNT_SCHEMA,
    version: 1,
    account: "HerculesSmartAccount",
    factory: "HerculesSmartAccountFactory",
    source: "hercules-hurc/HerculesSmartAccount.sol",
    network: network.id,
    chainId: network.chainId,
    production: false,
    mainnetEnabled: false,
    ownerAddress,
    salt: salt.toString(),
    entryPoint: Object.freeze({
      version: "0.8.0",
      address: ERC4337_ENTRYPOINT_V08,
      ownership: "external-infrastructure",
      codeVerificationRequired: true,
    }),
    factoryAddress,
    createAccountCalldata: factoryAddress
      ? encodeCreateAccountCall(ownerAddress, salt)
      : null,
    signature: Object.freeze({
      scheme: "secp256k1-ecrecover",
      hash: "entrypoint-userOpHash",
      lowSRequired: true,
    }),
    passkeyRecovery: Object.freeze({
      active: false,
      state: "security-audit-gated",
      enrollmentMetadataSupported: true,
      onchainVerifier: null,
      smartAccountRecoveryEnabled: false,
    }),
    deployment: Object.freeze({
      status: factoryAddress
        ? "factory-address-supplied"
        : "factory-not-deployed",
      signing: "external-local-wallet",
      broadcast: false,
      gasSpendAuthorized: false,
    }),
  });
}
