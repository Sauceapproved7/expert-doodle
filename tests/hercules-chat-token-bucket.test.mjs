import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../hercules-chat/ratelimit/redis-token-bucket.ts", import.meta.url),
  "utf8",
);

test("weighted token bucket uses Redis server time and atomic Lua execution", () => {
  assert.match(source, /redis\.call\(["']TIME["']\)/);
  assert.match(source, /redis\.call\(["']HGET["']/);
  assert.match(source, /redis\.call\(["']HSET["']/);
  assert.match(source, /ARGV\[1\]/);
  assert.match(source, /ARGV\[2\]/);
  assert.match(source, /ARGV\[3\]/);
  assert.match(source, /ARGV\[4\]/);
  assert.match(source, /"EVAL"/);
});

test("weighted token bucket rejects invalid and oversized reservations", () => {
  assert.match(source, /capacity/);
  assert.match(source, /request_cost/);
  assert.match(source, /request_cost > capacity/);
  assert.match(source, /REQUEST_EXCEEDS_CAPACITY/);
});

test("weighted token bucket returns admission, remaining credits, retry, reset, and reason", () => {
  assert.match(source, /return \{1,/);
  assert.match(source, /return \{0,/);
  assert.match(source, /return \{-1,/);
  assert.match(source, /retryAfterMs/);
  assert.match(source, /resetAfterMs/);
});

test("weighted token bucket expires idle state", () => {
  assert.match(source, /PEXPIRE/);
});
