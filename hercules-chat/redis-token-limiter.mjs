const DEFAULTS = Object.freeze({
  tokensPerMinute: 120_000,
  tokenBurst: 60_000,
  requestsPerMinute: 300,
  concurrentRequests: 20,
  dailyTokens: 10_000_000,
  outputCap: 2_048,
  overheadTokens: 256,
  reservationTtlMs: 180_000,
  keyTtlMs: 172_800_000,
});

export const TOKEN_BUCKET_LUA = `#!lua flags=allow-key-locking
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_per_ms = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local rpm_capacity = tonumber(ARGV[5])
local rpm_refill_per_ms = tonumber(ARGV[6])
local concurrency_limit = tonumber(ARGV[7])
local daily_limit = tonumber(ARGV[8])
local ttl_ms = tonumber(ARGV[9])
local daily_ttl_ms = tonumber(ARGV[10])
local reservation_id = ARGV[11]
local model_class = ARGV[12]

if cost <= 0 then return {0, 0, 0, "invalid_cost"} end
if cost > capacity then return {0, 0, -1, "request_exceeds_burst_capacity"} end

local function refill(key, cap, rate)
  local values = redis.call("HMGET", key, "tokens", "last_refill_ms")
  local tokens = tonumber(values[1])
  local last = tonumber(values[2])
  if tokens == nil then tokens = cap; last = now end
  local elapsed = math.max(0, now - last)
  tokens = math.min(cap, tokens + elapsed * rate)
  return tokens
end

local tpm = refill(KEYS[1], capacity, refill_per_ms)
local rpm = refill(KEYS[2], rpm_capacity, rpm_refill_per_ms)
local active = tonumber(redis.call("GET", KEYS[3]) or "0")
local daily = tonumber(redis.call("GET", KEYS[4]) or "0")

if tpm < cost then
  local retry = math.ceil((cost - tpm) / refill_per_ms)
  return {0, math.floor(tpm), retry, "tpm_exceeded"}
end

if rpm < 1 then
  local retry = math.ceil((1 - rpm) / rpm_refill_per_ms)
  return {0, math.floor(tpm), retry, "rpm_exceeded"}
end

if active >= concurrency_limit then
  return {0, math.floor(tpm), 1000, "concurrency_exceeded"}
end

if daily_limit > 0 and daily + cost > daily_limit then
  return {0, math.floor(tpm), 86400000 - (now % 86400000), "daily_budget_exceeded"}
end

tpm = tpm - cost
rpm = rpm - 1
redis.call("HSET", KEYS[1], "tokens", tpm, "last_refill_ms", now)
redis.call("HSET", KEYS[2], "tokens", rpm, "last_refill_ms", now)
redis.call("SET", KEYS[3], active + 1, "PX", ttl_ms)
redis.call("SET", KEYS[4], daily + cost, "PX", daily_ttl_ms)

redis.call("HSET", KEYS[5],
  "status", "active",
  "reserved_tokens", cost,
  "model_class", model_class,
  "reserved_at_ms", now
)
redis.call("PEXPIRE", KEYS[5], ttl_ms)

return {1, math.floor(tpm), 0, "allowed"}`;

export const REFUND_LUA = `#!lua flags=allow-key-locking
local actual = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local ttl_ms = tonumber(ARGV[4])
local daily_ttl_ms = tonumber(ARGV[5])

local values = redis.call("HMGET", KEYS[4], "status", "reserved_tokens")
local status = values[1]
local reserved = tonumber(values[2] or "0")

if status ~= "active" then
  return {0, 0, 0, "already_settled"}
end

if actual < 0 then return {0, 0, 0, "invalid_actual"} end
local refund = math.max(0, reserved - actual)

local bucket = redis.call("HMGET", KEYS[1], "tokens", "last_refill_ms")
local tokens = tonumber(bucket[1] or "0")
tokens = math.min(capacity, tokens + refund)
redis.call("HSET", KEYS[1], "tokens", tokens, "last_refill_ms", now)

local daily = math.max(0, tonumber(redis.call("GET", KEYS[2]) or "0") - refund)
redis.call("SET", KEYS[2], daily, "PX", daily_ttl_ms)

local active = math.max(0, tonumber(redis.call("GET", KEYS[3]) or "0") - 1)
redis.call("SET", KEYS[3], active, "PX", ttl_ms)

redis.call("HSET", KEYS[4],
  "status", "settled",
  "actual_tokens", actual,
  "refunded_tokens", refund,
  "settled_at_ms", now
)
redis.call("PEXPIRE", KEYS[4], ttl_ms)

return {1, math.floor(refund), math.floor(tokens), "settled"}`;

const sha256Hex = async (value) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const estimateTextTokens = (value) => {
  if (value === null || value === undefined) return 0;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

export function estimateReservedTokens({
  system = "",
  prompt = "",
  history = "",
  requestedMaxOutput = 0,
  outputCap = DEFAULTS.outputCap,
  overheadTokens = DEFAULTS.overheadTokens,
} = {}) {
  const inputTokens = estimateTextTokens(system) + estimateTextTokens(prompt) + estimateTextTokens(history);
  const outputReservation = Math.max(0, Math.min(Number(requestedMaxOutput) || 0, outputCap));
  const overheadReservation = Math.max(0, Math.trunc(Number(overheadTokens) || 0));
  return Object.freeze({
    inputTokens,
    outputReservation,
    overheadReservation,
    reservedTokens: inputTokens + outputReservation + overheadReservation,
  });
}

export function buildReservation({requestId, reservedTokens, modelClass, ttlMs}) {
  if (!requestId || !Number.isInteger(reservedTokens) || reservedTokens <= 0) {
    throw new Error("INVALID_RESERVATION");
  }
  return Object.freeze({requestId, reservedTokens, modelClass: String(modelClass || "general"), ttlMs});
}

export function normalizeLimiterDecision(result) {
  const row = Array.isArray(result) ? result : [];
  return {
    allowed: Number(row[0]) === 1,
    remainingTokens: Math.max(0, Number(row[1]) || 0),
    retryAfterMs: Math.max(0, Number(row[2]) || 0),
    reason: String(row[3] || "unknown"),
  };
}

function envNumber(env, key, fallback) {
  const value = Number(env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function limiterConfig(env = {}) {
  return Object.freeze({
    tokensPerMinute: envNumber(env, "HERCULES_TPM", DEFAULTS.tokensPerMinute),
    tokenBurst: envNumber(env, "HERCULES_TOKEN_BURST", DEFAULTS.tokenBurst),
    requestsPerMinute: envNumber(env, "HERCULES_RPM", DEFAULTS.requestsPerMinute),
    concurrentRequests: envNumber(env, "HERCULES_CONCURRENCY", DEFAULTS.concurrentRequests),
    dailyTokens: envNumber(env, "HERCULES_DAILY_TOKENS", DEFAULTS.dailyTokens),
    outputCap: envNumber(env, "HERCULES_MAX_OUTPUT_TOKENS", DEFAULTS.outputCap),
    overheadTokens: envNumber(env, "HERCULES_TOKEN_OVERHEAD", DEFAULTS.overheadTokens),
    reservationTtlMs: envNumber(env, "HERCULES_RESERVATION_TTL_MS", DEFAULTS.reservationTtlMs),
    keyTtlMs: envNumber(env, "HERCULES_RATE_LIMIT_KEY_TTL_MS", DEFAULTS.keyTtlMs),
  });
}

export function createRedisTokenLimiter({url, token, config = limiterConfig()} = {}) {
  if (!url || !token) throw new Error("REDIS_RATE_LIMITER_NOT_CONFIGURED");

  async function evalLua(script, keys, args) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", script, String(keys.length), ...keys, ...args.map(String)]),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) throw new Error("REDIS_RATE_LIMITER_UNAVAILABLE");
    return payload.result;
  }

  async function tenantHash(tenantId) {
    return (await sha256Hex(String(tenantId))).slice(0, 24);
  }

  async function admit({tenantId, requestId, reservedTokens, modelClass = "general", nowMs = Date.now()} = {}) {
    const hash = await tenantHash(tenantId);
    const tag = `{tenant:${hash}}`;
    const tpmRate = config.tokensPerMinute / 60_000;
    const rpmRate = config.requestsPerMinute / 60_000;
    const keys = [
      `${tag}:tpm`,
      `${tag}:rpm`,
      `${tag}:concurrency`,
      `${tag}:daily`,
      `${tag}:reservation:${requestId}`,
    ];
    const result = await evalLua(TOKEN_BUCKET_LUA, keys, [
      nowMs,
      config.tokenBurst,
      tpmRate,
      reservedTokens,
      config.requestsPerMinute,
      rpmRate,
      config.concurrentRequests,
      config.dailyTokens,
      config.reservationTtlMs,
      config.keyTtlMs,
      requestId,
      modelClass,
    ]);
    return normalizeLimiterDecision(result);
  }

  async function settle({tenantId, requestId, actualTokens, nowMs = Date.now()} = {}) {
    const hash = await tenantHash(tenantId);
    const tag = `{tenant:${hash}}`;
    const keys = [
      `${tag}:tpm`,
      `${tag}:daily`,
      `${tag}:concurrency`,
      `${tag}:reservation:${requestId}`,
    ];
    const result = await evalLua(REFUND_LUA, keys, [
      actualTokens,
      nowMs,
      config.tokenBurst,
      config.reservationTtlMs,
      config.keyTtlMs,
    ]);
    return normalizeLimiterDecision(result);
  }

  return Object.freeze({config, admit, settle});
}

export {DEFAULTS};
