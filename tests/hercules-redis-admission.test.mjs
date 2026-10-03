import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdmissionKeys,
  buildSettlementKeys,
  decodeAdmissionResult,
  decodeSettlementResult,
  RedisAiAdmissionController,
} from "../hercules-chat/redis/admission.mjs";

test("tenant keys use one opaque Redis Cluster hash tag and never expose the tenant id", () => {
  const keys = buildAdmissionKeys("tenant_7f3a", "req_123");
  const match = keys.tpm.match(/\{([^}]+)\}/);
  assert.ok(match);
  assert.ok(keys.rpm.includes("{" + match[1] + "}"));
  assert.ok(keys.concurrency.includes("{" + match[1] + "}"));
  assert.ok(keys.dailyBudget.includes("{" + match[1] + "}"));
  assert.ok(keys.monthlyBudget.includes("{" + match[1] + "}"));
  assert.ok(keys.leases.includes("{" + match[1] + "}"));
  assert.ok(keys.reservation.includes("{" + match[1] + "}"));
  assert.equal(Object.values(keys).some((key) => key.includes("tenant_7f3a")), false);
  assert.equal(keys.reservation.endsWith("req_123"), true);
});

test("admission decoder distinguishes a new reservation from an idempotent replay", () => {
  assert.deepEqual(
    decodeAdmissionResult([1, 53750000, 0, 3125, "allowed", 3]),
    {
      status: "allowed",
      remainingMicrocredits: 53750000,
      retryAfterMs: 0,
      resetAfterMs: 3125,
      concurrency: 3,
      isNewReservation: true,
    },
  );

  assert.equal(
    decodeAdmissionResult([2, 0, 0, 0, "idempotent_active", 6250000]).isNewReservation,
    false,
  );
});

test("admission decoder classifies permanent policy rejection without treating it as a transient 429", () => {
  assert.deepEqual(
    decodeAdmissionResult([-1, 0, 0, 0, "request_exceeds_burst_capacity"]),
    {
      status: "permanent_rejection",
      reason: "request_exceeds_burst_capacity",
      remainingMicrocredits: 0,
      retryAfterMs: 0,
      resetAfterMs: 0,
      concurrency: 0,
      isNewReservation: false,
    },
  );
});

test("admission decoder fails closed on unknown or malformed results", () => {
  assert.throws(
    () => decodeAdmissionResult([0, 0, 0, 0, "not_a_known_reason"]),
    /unknown admission result/,
  );
  assert.throws(
    () => decodeAdmissionResult(null),
    /invalid admission result/,
  );
});

test("settlement decoder treats duplicate settlement as idempotent", () => {
  assert.deepEqual(
    decodeSettlementResult([1, 820000, "settled"]),
    {status: "settled", refundMicrocredits: 820000, underReserved: false},
  );
  assert.deepEqual(
    decodeSettlementResult([2, 0, "already_settled"]),
    {status: "already_settled", refundMicrocredits: 0, underReserved: false},
  );
});

test("settlement keys preserve the tenant hash slot", () => {
  const admission = buildAdmissionKeys("tenant_7f3a", "req_123");
  const settlement = buildSettlementKeys("tenant_7f3a", "req_123");
  const tag = admission.tpm.match(/\{([^}]+)\}/)?.[1];
  assert.equal(settlement.tpm.includes("{" + tag + "}"), true);
  assert.equal(settlement.reservation.includes("{" + tag + "}"), true);
});

test("controller loads scripts once and uses EVALSHA for admission and settlement", async () => {
  const calls = [];
  const client = {
    async scriptLoad(script) {
      const sha = script.includes("weighted AI admission gate")
        ? "admission-sha"
        : "settlement-sha";
      calls.push(["load", sha]);
      return sha;
    },
    async evalsha(...args) {
      calls.push(["evalsha", ...args]);
      return calls.at(-1)[1] === "admission-sha"
        ? [1, 1000, 0, 10, "allowed", 1]
        : [1, 500, "settled"];
    },
  };

  const controller = new RedisAiAdmissionController(client);
  const admission = await controller.admit({
    tenantId: "tenant_7f3a",
    requestId: "req_123",
    tpmCapacityMicrocredits: 60000,
    tpmRefillMicrocreditsPerMs: 2,
    requestCostMicrocredits: 1000,
    rpmCapacity: 60,
    rpmRefillRequestsPerMs: 0.001,
    maxConcurrent: 4,
    reservationTtlMs: 120000,
    dailyBudgetMicrousd: 1000000,
    monthlyBudgetMicrousd: 5000000,
    dailyPeriod: "2026-10-03",
    monthlyPeriod: "2026-10",
    reservedCostMicrousd: 2500,
  });

  assert.equal(admission.status, "allowed");
  assert.equal(admission.isNewReservation, true);

  const settlement = await controller.settle({
    tenantId: "tenant_7f3a",
    requestId: "req_123",
    tpmCapacityMicrocredits: 60000,
    tpmRefillMicrocreditsPerMs: 2,
    actualCostMicrocredits: 500,
    actualCostMicrousd: 1200,
    reservationTtlMs: 120000,
  });

  assert.equal(settlement.status, "settled");
  assert.equal(calls.filter((call) => call[0] === "load").length, 3);
  assert.equal(calls.filter((call) => call[0] === "evalsha").length, 2);
});

test("controller reloads both scripts after NOSCRIPT", async () => {
  let loadCount = 0;
  let evalCount = 0;
  const client = {
    async scriptLoad(script) {
      loadCount += 1;
      return script.includes("weighted AI admission gate") ? "a-" + loadCount : "s-" + loadCount;
    },
    async evalsha() {
      evalCount += 1;
      if (evalCount === 1) throw new Error("NOSCRIPT No matching script");
      return [1, 1000, 0, 10, "allowed", 1];
    },
  };
  const controller = new RedisAiAdmissionController(client);
  const result = await controller.admit({
    tenantId: "tenant",
    requestId: "request",
    tpmCapacityMicrocredits: 60000,
    tpmRefillMicrocreditsPerMs: 2,
    requestCostMicrocredits: 1000,
    rpmCapacity: 60,
    rpmRefillRequestsPerMs: 0.001,
    maxConcurrent: 4,
    reservationTtlMs: 120000,
    dailyPeriod: "2026-10-03",
    monthlyPeriod: "2026-10",
  });
  assert.equal(result.status, "allowed");
  assert.equal(loadCount, 6);
  assert.equal(evalCount, 2);
});


test("settlement source refreshes the bucket timestamp before returning refunded credits", async () => {
  const settlement = await import("../hercules-chat/redis/admission.mjs").then((m) => m.scripts.settlement);
  assert.match(settlement, /redis\.call\("HSET",KEYS\[1\],[^\n]*"last_refill_ms",now\)/);
  assert.match(settlement, /"status","settled"/);
});


test("budget keys are period-scoped and remain in the tenant Redis Cluster slot", () => {
  const keys = buildAdmissionKeys("tenant_7f3a", "req_period", "2026-10-03", "2026-10");
  const tag = keys.tpm.match(/\{([^}]+)\}/)?.[1];
  assert.match(keys.dailyBudget, /:budget:day:2026-10-03$/);
  assert.match(keys.monthlyBudget, /:budget:month:2026-10$/);
  assert.equal(keys.dailyBudget.includes("{" + tag + "}"), true);
  assert.equal(keys.monthlyBudget.includes("{" + tag + "}"), true);
});

test("production contract rejects fractional refill rates", async () => {
  const client = {async scriptLoad(){return "sha";}, async evalsha(){return [-1,0,0,0,"invalid_tpm_refill"];}};
  const controller = new RedisAiAdmissionController(client);
  await assert.rejects(() => controller.admit({
    tenantId:"tenant", requestId:"req_fraction", tpmCapacityMicrocredits:60000,
    tpmRefillMicrocreditsPerMinute:120000000.5, requestCostMicrocredits:1000,
    rpmCapacity:60, rpmRefillRequestsPerMinute:60, maxConcurrent:4,
    reservationTtlMs:120000, dailyPeriod:"2026-10-03", monthlyPeriod:"2026-10"
  }), /integer/);
});

test("reservation contract stores accounting periods and a lease expiry for safe cleanup", async () => {
  const {scripts} = await import("../hercules-chat/redis/admission.mjs");
  assert.match(scripts.admission, /"daily_period",daily_period/);
  assert.match(scripts.admission, /"monthly_period",monthly_period/);
  assert.match(scripts.admission, /"lease_expires_at_ms"/);
});

test("cleanup script only releases an active expired reservation", async () => {
  const {scripts} = await import("../hercules-chat/redis/admission.mjs");
  assert.equal(typeof scripts.cleanup, "string");
  assert.match(scripts.cleanup, /status~="active"/);
  assert.match(scripts.cleanup, /lease_expires_at_ms/);
  assert.match(scripts.cleanup, /"status","expired"/);
});


test("concurrency is derived from active leases rather than an expiring global counter", async () => {
  const {scripts} = await import("../hercules-chat/redis/admission.mjs");
  assert.match(scripts.admission, /ZREMRANGEBYSCORE/);
  assert.match(scripts.admission, /ZCARD/);
  assert.doesNotMatch(scripts.admission, /SET",KEYS\[3\],concurrency\+1,"PX",ttl_ms/);
});

test("refill arithmetic guards the elapsed-times-rate product inside the safe integer range", async () => {
  const {scripts} = await import("../hercules-chat/redis/admission.mjs");
  assert.match(scripts.admission, /safe_refill/);
  assert.match(scripts.settlement, /safe_refill/);
});
