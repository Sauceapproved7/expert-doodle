import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const edge = await readFile(
  new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url),
  "utf8",
);
const adapter = await readFile(
  new URL("../hercules-chat/ratelimit/redis-token-bucket.ts", import.meta.url),
  "utf8",
);

test("Redis token-bucket adapter uses server-side EVAL and does not expose credentials", () => {
  assert.match(adapter, /EVAL/);
  assert.match(adapter, /HERCULES_REDIS_REST_URL/);
  assert.match(adapter, /HERCULES_REDIS_REST_TOKEN/);
  assert.match(adapter, /Authorization.*Bearer/);
  assert.doesNotMatch(adapter, /console\.(log|error).*TOKEN/i);
});

test("chat gateway has a token-admission boundary before model routing", () => {
  assert.match(edge, /reserveWeightedTokens/);
  assert.match(edge, /TOKEN_BUDGET_EXCEEDED/);
  const admission = edge.indexOf("reserveWeightedTokens");
  const routing = edge.indexOf("routeAi");
  assert.ok(admission >= 0 && routing >= 0 && admission < routing);
});
