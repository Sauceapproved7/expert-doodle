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
  assert.ok(keys.budget.includes("{" + match[1] + "}"));
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
  assert.equal(calls.filter((call) => call[0] === "load").length, 2);
  assert.equal(calls.filter((call) => call[0] === "evalsha").length, 2);
});


test("settlement source refreshes the bucket timestamp before returning refunded credits", async () => {
  const settlement = await import("../hercules-chat/redis/admission.mjs").then((m) => m.scripts.settlement);
  assert.match(settlement, /redis\\.call\\("HSET", KEYS\\[1\\][\\s\\S]*"last_refill_ms"/);
  assert.match(settlement, /status\", \"settled\"/);
});
