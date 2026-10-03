import test from "node:test";
import assert from "node:assert/strict";
import {isImmutableContainerImage} from "../scripts/verify-owner-code-only.mjs";

const digest = "a".repeat(64);

test("owner-code policy accepts explicit non-latest tag plus sha256 digest", () => {
  assert.equal(isImmutableContainerImage("postgres:16.15-alpine@sha256:" + digest), true);
  assert.equal(isImmutableContainerImage("node:22.23.3-alpine@sha256:" + digest), true);
});

test("owner-code policy rejects mutable or malformed runtime container references", () => {
  for (const image of [
    "postgres:16.15-alpine",
    "postgres@sha256:" + digest,
    "postgres:latest@sha256:" + digest,
    "node:22.23.3-alpine@sha256:short",
    "node:22.23.3-alpine@sha512:" + digest,
  ]) {
    assert.equal(isImmutableContainerImage(image), false, image);
  }
});
