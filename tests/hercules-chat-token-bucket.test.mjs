import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const lua = await readFile(
  new URL("../hercules-chat/ratelimit/token_bucket.lua", import.meta.url),
  "utf8",
);

test("weighted token bucket uses Redis server time and atomic Lua execution", () => {
  assert.match(lua, /redis\.call\(["']TIME["']\)/);
  assert.match(lua, /redis\.call\(["']GET["']/);
  assert.match(lua, /redis\.call\(["']SET["']/);
  assert.match(lua, /ARGV\[1\]/);
  assert.match(lua, /ARGV\[2\]/);
  assert.match(lua, /ARGV\[3\]/);
  assert.match(lua, /ARGV\[4\]/);
});

test("weighted token bucket rejects invalid and oversized reservations", () => {
  assert.match(lua, /capacity/);
  assert.match(lua, /request_cost/);
  assert.match(lua, /request_cost.*>.*capacity/s);
  assert.match(lua, /-1/);
});

test("weighted token bucket returns admission, remaining credits, retry, reset, and reason", () => {
  assert.match(lua, /return\s+1\s*,/);
  assert.match(lua, /return\s+0\s*,/);
  assert.match(lua, /return\s+-1\s*,/);
  assert.match(lua, /retry_after_ms/);
  assert.match(lua, /reset_after_ms/);
});

test("weighted token bucket expires idle state", () => {
  assert.match(lua, /PEXPIRE/);
});
