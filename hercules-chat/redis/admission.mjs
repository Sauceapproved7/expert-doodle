import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

const ADMISSION_LUA = await readFile(
  new URL("./token-admission.lua", import.meta.url),
  "utf8",
);
const SETTLEMENT_LUA = await readFile(new URL("./token-settlement.lua", import.meta.url), "utf8");
const CLEANUP_LUA = await readFile(new URL("./reservation-cleanup.lua", import.meta.url), "utf8");

const ADMISSION_REASONS = new Set([
  "allowed",
  "idempotent_active",
  "token_rate_limited",
  "request_rate_limited",
  "concurrency_limited",
  "daily_budget_exceeded",
  "monthly_budget_exceeded",
  "request_exceeds_burst_capacity",
  "reservation_tenant_mismatch",
  "reservation_already_settled",
]);

const SETTLEMENT_REASONS = new Set([
  "settled",
  "already_settled",
  "reservation_not_found",
  "reservation_not_active",
  "under_reserved",
  "reservation_period_mismatch",
]);

function fingerprint(value) {
  const input = String(value ?? "").trim();
  if (!input) throw new TypeError("tenantId is required");
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

function requestKey(value) {
  const input = String(value ?? "").trim();
  if (!input || input.length > 200 || /[\s{}]/.test(input)) {
    throw new TypeError("requestId must be a bounded key-safe identifier");
  }
  return input;
}

function hashTag(tenantId) {
  return "t:" + fingerprint(tenantId);
}

export function buildAdmissionKeys(tenantId, requestId, dailyPeriod = "unspecified-day", monthlyPeriod = "unspecified-month") {
  const tag = hashTag(tenantId);
  const request = requestKey(requestId);
  return {
    tpm: `rl:{${tag}}:tpm`,
    rpm: `rl:{${tag}}:rpm`,
    concurrency: `rl:{${tag}}:concurrency`,
    dailyBudget: `rl:{${tag}}:budget:day:${requestKey(dailyPeriod)}`,
    monthlyBudget: `rl:{${tag}}:budget:month:${requestKey(monthlyPeriod)}`,
    reservation: `rl:{${tag}}:reservation:${request}`,
    leases: `rl:{${tag}}:leases`,
  };
}

export function buildCleanupKeys(tenantId, requestId) {
  const keys = buildAdmissionKeys(tenantId, requestId);
  return {concurrency: keys.concurrency, reservation: keys.reservation, leases: keys.leases};
}

export function buildSettlementKeys(tenantId, requestId, dailyPeriod = "unspecified-day", monthlyPeriod = "unspecified-month") {
  const keys = buildAdmissionKeys(tenantId, requestId, dailyPeriod, monthlyPeriod);
  return {
    tpm: keys.tpm,
    concurrency: keys.concurrency,
    dailyBudget: keys.dailyBudget,
    monthlyBudget: keys.monthlyBudget,
    reservation: keys.reservation,
    leases: keys.leases,
  };
}

function assertArray(result, name) {
  if (!Array.isArray(result) || result.length < 5) {
    throw new Error(`invalid ${name} result`);
  }
}

export function decodeAdmissionResult(result) {
  assertArray(result, "admission");
  const code = Number(result[0]);
  const reason = String(result[4]);
  if (!ADMISSION_REASONS.has(reason)) throw new Error(`unknown admission result: ${reason}`);
  if (code === 1) {
    return {
      status: "allowed",
      remainingMicrocredits: Number(result[1]),
      retryAfterMs: Number(result[2]),
      resetAfterMs: Number(result[3]),
      concurrency: Number(result[5]),
      isNewReservation: true,
    };
  }
  if (code === 2 && reason === "idempotent_active") {
    return {
      status: "idempotent_active",
      remainingMicrocredits: 0,
      retryAfterMs: 0,
      resetAfterMs: 0,
      concurrency: 0,
      isNewReservation: false,
    };
  }
  if (code === -1) {
    return {
      status: "permanent_rejection",
      reason,
      remainingMicrocredits: Number(result[1]),
      retryAfterMs: Number(result[2]),
      resetAfterMs: Number(result[3]),
      concurrency: 0,
      isNewReservation: false,
    };
  }
  if (code === 0) {
    return {
      status: reason,
      remainingMicrocredits: Number(result[1]),
      retryAfterMs: Number(result[2]),
      resetAfterMs: Number(result[3]),
      concurrency: 0,
      isNewReservation: false,
    };
  }
  throw new Error(`invalid admission result code for ${reason}`);
}

export function decodeSettlementResult(result) {
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error("invalid settlement result");
  }
  const code = Number(result[0]);
  const refundMicrocredits = Number(result[1]);
  const reason = String(result[2]);
  if (!SETTLEMENT_REASONS.has(reason)) throw new Error(`unknown settlement result: ${reason}`);
  if (code === 1 && reason === "settled") {
    return {status: "settled", refundMicrocredits, underReserved: false};
  }
  if (code === 1 && reason === "under_reserved") {
    return {status: "under_reserved", refundMicrocredits, underReserved: true};
  }
  if (code === 2 && reason === "already_settled") {
    return {status: "already_settled", refundMicrocredits, underReserved: false};
  }
  if (code === 0) {
    return {status: reason, refundMicrocredits, underReserved: false};
  }
  throw new Error(`invalid settlement result code for ${reason}`);
}

function integerRate(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer per minute`);
  return value;
}

export class RedisAiAdmissionController {
  constructor(client) {
    if (!client || typeof client.evalsha !== "function" || typeof client.scriptLoad !== "function") {
      throw new TypeError("client must expose evalsha() and scriptLoad()");
    }
    this.client = client;
    this.shas = null;
  }

  async loadScripts() {
    if (!this.shas) {
      const [admission, settlement, cleanup] = await Promise.all([
        this.client.scriptLoad(ADMISSION_LUA), this.client.scriptLoad(SETTLEMENT_LUA), this.client.scriptLoad(CLEANUP_LUA),
      ]);
      this.shas = {admission, settlement, cleanup};
    }
    return this.shas;
  }

  async evalWithReload(kind, keys, args) {
    const shas = await this.loadScripts();
    const sha = shas[kind];
    try {
      return await this.client.evalsha(sha, keys.length, ...keys, ...args);
    } catch (error) {
      if (!String(error?.message ?? error).includes("NOSCRIPT")) throw error;
      this.shas = null;
      const fresh = await this.loadScripts();
      return this.client.evalsha(fresh[kind], keys.length, ...keys, ...args);
    }
  }

  async admit(input) {
    const keys = buildAdmissionKeys(input.tenantId, input.requestId, input.dailyPeriod, input.monthlyPeriod);
    const tenantFingerprint = fingerprint(input.tenantId);
    const result = await this.evalWithReload("admission", Object.values(keys), [
      input.tpmCapacityMicrocredits,
      integerRate(input.tpmRefillMicrocreditsPerMinute ?? Number(input.tpmRefillMicrocreditsPerMs) * 60000, "tpm refill"),
      input.requestCostMicrocredits,
      input.rpmCapacity,
      integerRate(input.rpmRefillRequestsPerMinute ?? Number(input.rpmRefillRequestsPerMs) * 60000, "rpm refill"),
      input.maxConcurrent,
      input.reservationTtlMs,
      input.dailyBudgetMicrousd ?? 0,
      input.monthlyBudgetMicrousd ?? 0,
      input.dailyPeriod,
      input.monthlyPeriod,
      input.reservedCostMicrousd ?? 0,
      requestKey(input.requestId),
      tenantFingerprint,
    ]);
    return decodeAdmissionResult(result);
  }

  async cleanupExpired(input) {
    const keys = buildCleanupKeys(input.tenantId, input.requestId);
    const result = await this.evalWithReload("cleanup", Object.values(keys), [requestKey(input.requestId), input.reservationTtlMs]);
    if (!Array.isArray(result) || result.length < 2) throw new Error("invalid cleanup result");
    return {code: Number(result[0]), status: String(result[1])};
  }

  async settle(input) {
    const keys = buildSettlementKeys(input.tenantId, input.requestId, input.dailyPeriod, input.monthlyPeriod);
    const result = await this.evalWithReload("settlement", Object.values(keys), [
      input.tpmCapacityMicrocredits,
      integerRate(input.tpmRefillMicrocreditsPerMinute ?? Number(input.tpmRefillMicrocreditsPerMs) * 60000, "tpm refill"),
      input.actualCostMicrocredits,
      input.actualCostMicrousd ?? 0,
      input.reservationTtlMs,
      input.dailyPeriod,
      input.monthlyPeriod,
      requestKey(input.requestId),
    ]);
    return decodeSettlementResult(result);
  }
}

export const scripts = Object.freeze({admission: ADMISSION_LUA, settlement: SETTLEMENT_LUA, cleanup: CLEANUP_LUA});
