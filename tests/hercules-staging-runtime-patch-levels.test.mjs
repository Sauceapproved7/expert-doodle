import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const expected = Object.freeze({
  postgres: "postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685",
  postgrest: "postgrest/postgrest:v12.2.12@sha256:5f4ce744539bbba786b4e24dbbd95bdb2a956dcf568c5374995a0ff4a68f5bd2",
  node: "node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402",
});

test("staging runtime uses the approved patched immutable image set", async () => {
  const compose = await readFile(new URL("../staging-plane/compose.yml", import.meta.url), "utf8");
  const images = [...compose.matchAll(/^\s*image:\s*["']?([^"'#\s]+)["']?/gm)].map((match) => match[1]);
  assert.ok(images.includes(expected.postgres));
  assert.ok(images.includes(expected.postgrest));
  assert.ok(images.includes(expected.node));
  assert.equal(images.filter((image) => image === expected.postgres).length, 2);
  assert.equal(images.filter((image) => image === expected.node).length, 3);
});
