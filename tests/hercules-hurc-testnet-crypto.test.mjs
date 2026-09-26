import test from "node:test";
import assert from "node:assert/strict";
import {
  SECP,
  bytesToHex,
  keccak256,
  privateKeyToAddress,
  privateKeyToPublicKey,
  rlpEncode,
  signDigest,
  signEip1559Transaction,
  verifyDigest,
} from "../hercules-hurc/testnet-crypto.mjs";

const PRIVATE_KEY_ONE = "0x" + "0".repeat(63) + "1";

test("Keccak-256 matches the canonical empty-string vector", () => {
  assert.equal(
    bytesToHex(keccak256(new Uint8Array([]))),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
});

test("RLP encodes the canonical cat/dog list vector", () => {
  assert.equal(
    bytesToHex(rlpEncode(["cat", "dog"])),
    "0xc88363617483646f67",
  );
});

test("secp256k1 private key 1 derives the known Ethereum address", () => {
  assert.equal(
    privateKeyToAddress(PRIVATE_KEY_ONE),
    "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
  );
});

test("deterministic signature verifies and enforces low-s", async () => {
  const digest = keccak256(new TextEncoder().encode("HURC testnet signer"));
  const signature = await signDigest(PRIVATE_KEY_ONE, digest);

  assert.equal(
    verifyDigest(privateKeyToPublicKey(PRIVATE_KEY_ONE), digest, signature),
    true,
  );
  assert.ok(signature.s <= SECP.N / 2n);
});

test("Base Sepolia EIP-1559 signing is deterministic and testnet-only", async () => {
  const tx = {
    chainId: 84532n,
    nonce: 0n,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 2_000_000n,
    gasLimit: 1_000_000n,
    to: null,
    value: 0n,
    data: "0x60006000",
  };

  const first = await signEip1559Transaction(tx, PRIVATE_KEY_ONE);
  const second = await signEip1559Transaction(tx, PRIVATE_KEY_ONE);

  assert.equal(first.rawTransaction, second.rawTransaction);
  assert.equal(first.transactionHash, second.transactionHash);
  assert.equal(
    first.from,
    "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
  );
  assert.ok(first.rawTransaction.startsWith("0x02"));

  await assert.rejects(
    () => signEip1559Transaction({...tx, chainId: 1n}, PRIVATE_KEY_ONE),
    /only supports Base Sepolia/,
  );
});
