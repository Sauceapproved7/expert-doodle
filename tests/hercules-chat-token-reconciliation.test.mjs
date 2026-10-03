import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../hercules-chat/sql/backend-v1.sql", import.meta.url), "utf8");
const edge = await readFile(new URL("../hercules-chat/hercules-chat-edge.ts", import.meta.url), "utf8");

test("usage ledger persists the original token reservation", () => {
  assert.match(sql, /reserved_tokens bigint/i);
  assert.match(sql, /p_reserved_tokens[\s\S]*'reserved'/i);
});

test("finalization refunds only unused reserved capacity", () => {
  assert.match(sql, /hercules_refund_token_reservation/i);
  assert.match(sql, /greatest\(0[\s\S]*v_reserved_tokens/i);
  assert.match(sql, /least\(v_capacity::numeric[\s\S]*tokens\s*\+/i);
});

test("gateway finalizes with conservative estimated actual token usage", () => {
  assert.match(edge, /estimatedInputTokens/i);
  assert.match(edge, /estimatedOutputTokens/i);
  assert.match(edge, /finalize\([\s\S]*estimatedInputTokens[\s\S]*estimatedOutputTokens/i);
});
