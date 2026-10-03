import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {isImmutableContainerImage} from "../scripts/verify-owner-code-only.mjs";

const digest = "a".repeat(64);

test("owner-code policy accepts only tag-plus-sha256 immutable container references", () => {
  assert.equal(isImmutableContainerImage("postgres:16.4-alpine@sha256:" + digest), true);
  assert.equal(isImmutableContainerImage("postgrest/postgrest:v12.2.3@sha256:" + digest), true);
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

test("every Hercules staging runtime image is immutable and digest pinned", async () => {
  const compose = await readFile(new URL("../staging-plane/compose.yml", import.meta.url), "utf8");
  const images = [...compose.matchAll(/^\s*image:\s*["']?([^"'#\s]+)["']?/gm)].map((match) => match[1]);
  assert.ok(images.length >= 6, "expected all staging services to declare images");
  for (const image of images) assert.equal(isImmutableContainerImage(image), true, image);
});
