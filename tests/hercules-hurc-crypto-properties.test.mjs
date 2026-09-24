import test from "node:test";
import assert from "node:assert/strict";
import {
  SECP,
  bigIntToBytes,
  bytesToBigInt,
  keccak256,
  privateKeyToAddress,
  privateKeyToPublicKey,
  signDigest,
  signEip1559Transaction,
  verifyDigest,
} from "../hercules-hurc/testnet-crypto.mjs";

const encoder = new TextEncoder();

function derivedKey(index) {
  const seed = keccak256(encoder.encode("hercules-property-key-" + index));
  const d = (bytesToBigInt(seed) % (SECP.N - 1n)) + 1n;
  return bigIntToBytes(d, 32);
}

test("multiple deterministic secp256k1 signatures verify and reject tampering", async () => {
  const addresses = new Set();

  for (let index = 0; index < 16; index++) {
    const key = derivedKey(index);
    const publicKey = privateKeyToPublicKey(key);
    const address = privateKeyToAddress(key);
    const digest = keccak256(encoder.encode("hercules-property-digest-" + index));
    const signature = await signDigest(key, digest);

    assert.match(address, /^0x[0-9a-f]{40}$/);
    assert.equal(addresses.has(address), false);
    addresses.add(address);

    assert.equal(verifyDigest(publicKey, digest, signature), true);
    assert.ok(signature.r > 0n && signature.r < SECP.N);
    assert.ok(signature.s > 0n && signature.s <= SECP.N / 2n);

    const tampered = Uint8Array.from(digest);
    tampered[0] ^= 1;
    assert.equal(verifyDigest(publicKey, tampered, signature), false);
  }
});

test("private-key boundary values fail closed", () => {
  assert.throws(() => privateKeyToPublicKey(new Uint8Array(32)), /invalid private key/);
  assert.throws(
    () => privateKeyToPublicKey(bigIntToBytes(SECP.N, 32)),
    /invalid private key/,
  );
});

test("EIP-1559 signer rejects non-Base-Sepolia chains across representative inputs", async () => {
  const key = derivedKey(99);
  const base = {
    nonce: 0n,
    maxPriorityFeePerGas: 1_000_000n,
    maxFeePerGas: 2_000_000n,
    gasLimit: 100_000n,
    to: "0x" + "11".repeat(20),
    value: 0n,
    data: "0x",
  };

  for (const chainId of [1n, 10n, 8453n, 11155111n, 0n]) {
    await assert.rejects(
      () => signEip1559Transaction({...base, chainId}, key),
      /only supports Base Sepolia/,
    );
  }

  const signed = await signEip1559Transaction({...base, chainId: 84532n}, key);
  assert.ok(signed.rawTransaction.startsWith("0x02"));
  assert.match(signed.transactionHash, /^0x[0-9a-f]{64}$/);
});
