import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(
  new URL("../hercules-hurc/testnet-signer-edge.ts", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../hercules-hurc/sql/hurc-test-signer.sql", import.meta.url),
  "utf8",
);

test("live test signer is hard-pinned to Base Sepolia", () => {
  assert.match(source, /network:\s*"base-sepolia"/);
  assert.match(source, /chainId:\s*84532/);
  assert.doesNotMatch(source, /mainnetEnabled:\s*true/);
});

test("live signer requires a dedicated control token and bounded requests", () => {
  assert.match(source, /HURC_SIGNER_CONTROL_TOKEN/);
  assert.match(source, /CONTROL\.length < 32/);
  assert.match(source, /authorization/);
  assert.match(source, /safeEqual/);
  assert.match(source, /MAX_REQUEST_BYTES = 4096/);
  assert.match(source, /request_too_large/);
});

test("live signer stores secret in Vault and never returns private key", () => {
  assert.match(source, /hercules_store_secret/);
  assert.match(source, /privateKeyReturned:\s*false/);
  assert.match(source, /privateKey\.fill\(0\)/);
  assert.doesNotMatch(source, /privateKeyReturned:\s*true/);
});

test("signer registry stores only metadata and a Vault reference", () => {
  assert.match(migration, /secret_ref uuid not null/);
  assert.doesNotMatch(migration, /private_key/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on table public\.hercules_hurc_test_signers from anon, authenticated/i);
  assert.match(migration, /one_active_signer_per_network/i);
});
