import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../hercules-chat/sql/backend-v1.sql", import.meta.url), "utf8");
const edge = await readFile(new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url), "utf8");

test("plan limits include weighted token throughput and burst controls", () => {
  assert.match(sql, /tokens_per_minute/i);
  assert.match(sql, /token_burst_capacity/i);
});

test("reservation accepts a token cost and maintains atomic token state", () => {
  assert.match(sql, /p_reserved_tokens/i);
  assert.match(sql, /hercules_token_buckets/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /TOKEN_BUDGET_EXCEEDED/i);
});

test("gateway preserves the Postgres reservation boundary and applies weighted Redis admission before model routing", () => {
  assert.match(edge, /rpc\/hercules_chat_reserve_ai_request/);
  assert.match(edge, /estimatedInputTokens/);
  assert.match(edge, /reservedOutputTokens/);
  assert.match(edge, /tokenReservation/);
  assert.match(edge, /reserveWeightedTokens/);
  assert.ok(edge.indexOf("reserveWeightedTokens(") < edge.indexOf("routeAi(req, system, routedPrompt)"));
});
