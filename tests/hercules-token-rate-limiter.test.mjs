import test from "node:test";
import assert from "node:assert/strict";
import {TOKEN_BUCKET_LUA, REFUND_LUA, buildReservation, estimateReservedTokens, normalizeLimiterDecision, dailyBudgetWindow} from "../hercules-chat/redis-token-limiter.mjs";

test("reserves input plus bounded output and overhead", () => {
  const plan = estimateReservedTokens({
    system: "x".repeat(400),
    prompt: "y".repeat(800),
    history: "z".repeat(400),
    requestedMaxOutput: 2000,
    outputCap: 1200,
    overheadTokens: 250,
  });
  assert.equal(plan.inputTokens, 400);
  assert.equal(plan.outputReservation, 1200);
  assert.equal(plan.overheadReservation, 250);
  assert.equal(plan.reservedTokens, 1850);
});

test("reservation record is immutable and request-scoped", () => {
  const r = buildReservation({
    tenantKey: "tenant_hash",
    requestId: "req-1",
    reservedTokens: 6250,
    modelClass: "general",
    ttlMs: 180000,
  });
  assert.deepEqual(r, {
    requestId: "req-1",
    reservedTokens: 6250,
    modelClass: "general",
    ttlMs: 180000,
  });
});

test("Lua admission is weighted and atomic across TPM, RPM, concurrency, and daily budget", () => {
  assert.match(TOKEN_BUCKET_LUA, /redis\.call\("HMGET"/);
  assert.match(TOKEN_BUCKET_LUA, /cost/);
  assert.match(TOKEN_BUCKET_LUA, /tpm < cost/);
  assert.match(TOKEN_BUCKET_LUA, /concurrency/);
  assert.match(TOKEN_BUCKET_LUA, /daily/);
  assert.match(TOKEN_BUCKET_LUA, /HSET/);
  assert.match(TOKEN_BUCKET_LUA, /PEXPIRE/);
});

test("Lua refund settles unused reservation and concurrency exactly once", () => {
  assert.match(REFUND_LUA, /status/);
  assert.match(REFUND_LUA, /settled/);
  assert.match(REFUND_LUA, /refund/);
  assert.match(REFUND_LUA, /concurrency/);
  assert.match(REFUND_LUA, /HSET/);
});

test("limiter converts denial into retry metadata without exposing Redis internals", () => {
  const denied = normalizeLimiterDecision([0, 1200, 2525, "tpm_exceeded"]);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remainingTokens, 1200);
  assert.equal(denied.retryAfterMs, 2525);
  assert.equal(denied.reason, "tpm_exceeded");
});


test("daily budget is date-scoped and expires at the next UTC accounting boundary", () => {
  const window = dailyBudgetWindow(Date.UTC(2026, 9, 3, 23, 59, 30));
  assert.equal(window.dateKey, "2026-10-03");
  assert.equal(window.ttlMs, 30_000);
});

test("EVAL scripts are plain Lua scripts rather than Redis Function library source", () => {
  assert.equal(TOKEN_BUCKET_LUA.startsWith("#!lua"), false);
  assert.equal(REFUND_LUA.startsWith("#!lua"), false);
});
