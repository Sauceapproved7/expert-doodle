const REDIS_URL = Deno.env.get("HERCULES_REDIS_REST_URL") ?? "";
const REDIS_TOKEN = Deno.env.get("HERCULES_REDIS_REST_TOKEN") ?? "";

export type TokenBucketDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAfterMs: number;
  reason: string;
};

const SCRIPT = `-- Hercules weighted token bucket.
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local request_cost = tonumber(ARGV[3])
local ttl_ms = tonumber(ARGV[4])

if not capacity or capacity <= 0 then return {-1,0,0,0,"INVALID_CAPACITY"} end
if not refill_per_ms or refill_per_ms < 0 then return {-1,0,0,0,"INVALID_REFILL_RATE"} end
if not request_cost or request_cost < 0 then return {-1,0,0,0,"INVALID_REQUEST_COST"} end
if not ttl_ms or ttl_ms <= 0 then return {-1,0,0,0,"INVALID_TTL"} end
if request_cost > capacity then return {-1,0,0,0,"REQUEST_EXCEEDS_CAPACITY"} end

local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local tokens = tonumber(redis.call("HGET", key, "tokens"))
local last = tonumber(redis.call("HGET", key, "last_ms"))
if tokens == nil then tokens = capacity end
if last == nil then last = now end
if now < last then now = last end

local elapsed = now - last
if elapsed > 0 and refill_per_ms > 0 then
  tokens = math.min(capacity, tokens + elapsed * refill_per_ms)
end

if request_cost <= tokens then
  tokens = tokens - request_cost
  redis.call("HSET", key, "tokens", tokens, "last_ms", now)
  redis.call("PEXPIRE", key, math.floor(ttl_ms))
  local reset = refill_per_ms > 0 and math.ceil((capacity - tokens) / refill_per_ms) or 0
  return {1, math.floor(tokens), 0, reset, "ADMITTED"}
end

redis.call("HSET", key, "tokens", tokens, "last_ms", now)
redis.call("PEXPIRE", key, math.floor(ttl_ms))
local retry = refill_per_ms > 0 and math.ceil((request_cost - tokens) / refill_per_ms) or 0
local reset = refill_per_ms > 0 and math.ceil((capacity - tokens) / refill_per_ms) or 0
return {0, math.floor(tokens), retry, reset, "RATE_LIMITED"}`;

function requireRedis() {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error("TOKEN_BUCKET_NOT_CONFIGURED");
}

export async function reserveWeightedTokens(
  key: string,
  capacity: number,
  refillPerMs: number,
  requestCost: number,
  ttlMs: number,
): Promise<TokenBucketDecision> {
  requireRedis();
  if (!key || !Number.isFinite(capacity) || !Number.isFinite(refillPerMs) ||
      !Number.isFinite(requestCost) || !Number.isFinite(ttlMs)) {
    throw new Error("INVALID_TOKEN_BUCKET_ARGUMENTS");
  }

  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      "EVAL",
      SCRIPT,
      "1",
      key,
      String(Math.trunc(capacity)),
      String(refillPerMs),
      String(Math.trunc(requestCost)),
      String(Math.trunc(ttlMs)),
    ]),
  });

  const body = await response.json().catch(() => null) as { result?: unknown; error?: string } | null;
  if (!response.ok || body?.error) throw new Error("TOKEN_BUCKET_UNAVAILABLE");

  if (!Array.isArray(body?.result) || body.result.length < 5) {
    throw new Error("TOKEN_BUCKET_INVALID_RESPONSE");
  }

  const result = body.result.map(Number);
  const reason = String(body.result[4] ?? "UNKNOWN");
  if (result[0] === -1) throw new Error(reason);

  return {
    allowed: result[0] === 1,
    remaining: Math.max(0, result[1]),
    retryAfterMs: Math.max(0, result[2]),
    resetAfterMs: Math.max(0, result[3]),
    reason,
  };
}
