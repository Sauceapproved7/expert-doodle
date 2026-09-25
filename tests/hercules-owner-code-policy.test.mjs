import test from "node:test";
import assert from "node:assert/strict";
import {isImmutableContainerImage} from "../scripts/verify-owner-code-only.mjs";

const digest = "a".repeat(64);

test("owner-code policy accepts tag-plus-sha256 container references", () => {
  assert.equal(
    isImmutableContainerImage("postgres:16.4-alpine@sha256:" + digest),
    true,
  );
  assert.equal(
    isImmutableContainerImage("postgrest/postgrest:v12.2.3@sha256:" + digest),
    true,
  );
});

test("owner-code policy rejects mutable or malformed container references", () => {
  for (const image of [
    "postgres:16.4-alpine",
    "postgres@sha256:" + digest,
    "postgres:latest@sha256:" + digest,
    "node:22.12.0-alpine@sha256:short",
    "node:22.12.0-alpine@sha512:" + digest,
  ]) {
    assert.equal(isImmutableContainerImage(image), false, image);
  }
});
