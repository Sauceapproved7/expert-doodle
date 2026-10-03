import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  ERC4337_ENTRYPOINT_V08,
  buildSmartAccountPlan,
  encodeCreateAccountCall,
} from "../hercules-hurc/smart-account-plan.mjs";

const OWNER = "0x1111111111111111111111111111111111111111";
const FACTORY = "0x2222222222222222222222222222222222222222";

test("pins ERC-4337 EntryPoint v0.8", () => {
  assert.equal(
    ERC4337_ENTRYPOINT_V08,
    "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
  );
});

test("builds Ethereum Sepolia smart-account plan with passkey recovery still gated", () => {
  const plan = buildSmartAccountPlan({
    network: "ethereum-sepolia",
    ownerAddress: OWNER,
    salt: 7n,
    factoryAddress: FACTORY,
  });

  assert.equal(plan.chainId, 11155111);
  assert.equal(plan.production, false);
  assert.equal(plan.entryPoint.address, ERC4337_ENTRYPOINT_V08);
  assert.equal(plan.passkeyRecovery.active, false);
  assert.match(plan.passkeyRecovery.state, /audit|gated|inactive/);
  assert.equal(plan.mainnetEnabled, false);
});

test("allows Base Sepolia but rejects mainnet or unknown networks", () => {
  assert.equal(
    buildSmartAccountPlan({
      network: "base-sepolia",
      ownerAddress: OWNER,
      salt: 0n,
    }).chainId,
    84532,
  );

  assert.throws(
    () => buildSmartAccountPlan({
      network: "ethereum-mainnet",
      ownerAddress: OWNER,
      salt: 0n,
    }),
    /unsupported HURC test network/,
  );
});

test("rejects secret-bearing deployment input", () => {
  assert.throws(
    () => buildSmartAccountPlan({
      network: "ethereum-sepolia",
      ownerAddress: OWNER,
      salt: 0n,
      privateKey: "0xabc",
    }),
    /secret/i,
  );

  assert.throws(
    () => buildSmartAccountPlan({
      network: "ethereum-sepolia",
      ownerAddress: OWNER,
      salt: 0n,
      mnemonic: "word word",
    }),
    /secret/i,
  );
});

test("factory createAccount calldata is ABI-shaped and secret-free", () => {
  const data = encodeCreateAccountCall(OWNER, 7n);

  assert.match(data, /^0x[0-9a-f]+$/);
  assert.equal(data.length, 2 + 8 + 64 + 64);
  assert.equal(data.slice(10, 74).endsWith(OWNER.slice(2)), true);
  assert.equal(data.slice(-64), "7".padStart(64, "0"));
});

test("Solidity source has no third-party imports or dangerous execution primitives", async () => {
  const source = await readFile(
    new URL("../hercules-hurc/HerculesSmartAccount.sol", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /\bimport\b/);
  assert.doesNotMatch(source, /\bdelegatecall\b/);
  assert.doesNotMatch(source, /\bselfdestruct\b/);
  assert.doesNotMatch(source, /tx\.origin/);
  assert.match(source, /validateUserOp/);
  assert.match(source, /HerculesSmartAccountFactory/);
  assert.match(source, /SECP256K1_HALF_N/);
});
