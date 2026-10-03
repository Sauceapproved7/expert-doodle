-- Hercules AI reservation settlement.
-- KEYS[1] tpm bucket, KEYS[2] concurrency, KEYS[3] budget, KEYS[4] reservation.
-- All keys must share the tenant hash tag in Redis Cluster.
-- ARGV: 1 capacity microcredits, 2 refill microcredits/ms,
-- 3 actual token cost microcredits, 4 actual cost microUSD, 5 key ttl ms.

local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local actual_tokens = tonumber(ARGV[3])
local actual_budget = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

if capacity == nil or capacity <= 0 then return {-1, 0, "invalid_capacity"} end
if refill_per_ms == nil or refill_per_ms <= 0 then return {-1, 0, "invalid_refill_rate"} end
if actual_tokens == nil or actual_tokens < 0 then return {-1, 0, "invalid_actual_tokens"} end
if actual_budget == nil or actual_budget < 0 then return {-1, 0, "invalid_actual_budget"} end
if ttl_ms == nil or ttl_ms <= 0 then return {-1, 0, "invalid_ttl"} end

local status = redis.call("HGET", KEYS[4], "status")
if not status then return {0, 0, "reservation_not_found"} end
if status == "settled" then return {2, 0, "already_settled"} end
if status ~= "active" then return {0, 0, "reservation_not_active"} end

local reserved_tokens = tonumber(redis.call("HGET", KEYS[4], "reserved_cost_microcredits")) or 0
local reserved_budget = tonumber(redis.call("HGET", KEYS[4], "reserved_cost_microusd")) or 0
local token_refund = math.max(0, reserved_tokens - actual_tokens)
local budget_refund = math.max(0, reserved_budget - actual_budget)
local under_reserved = actual_tokens > reserved_tokens or actual_budget > reserved_budget

local redis_time = redis.call("TIME")
local now_ms = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)
local values = redis.call("HMGET", KEYS[1], "credits", "last_refill_ms")
local credits = tonumber(values[1])
local last = tonumber(values[2])
if credits == nil or last == nil then
  credits = capacity
  last = now_ms
end
local elapsed = math.max(0, now_ms - last)
local refilled = math.min(capacity, credits + elapsed * refill_per_ms)
local updated = math.min(capacity, refilled + token_refund)
redis.call("HSET", KEYS[1], "credits", updated, "last_refill_ms", now_ms)
redis.call("PEXPIRE", KEYS[1], ttl_ms)

local concurrency = tonumber(redis.call("GET", KEYS[2])) or 0
redis.call("SET", KEYS[2], math.max(0, concurrency - 1), "PX", ttl_ms)

if budget_refund > 0 then
  local daily_used = tonumber(redis.call("HGET", KEYS[3], "daily_used")) or 0
  local monthly_used = tonumber(redis.call("HGET", KEYS[3], "monthly_used")) or 0
  redis.call("HSET", KEYS[3],
    "daily_used", math.max(0, daily_used - budget_refund),
    "monthly_used", math.max(0, monthly_used - budget_refund))
  redis.call("PEXPIRE", KEYS[3], ttl_ms)
end

redis.call("HSET", KEYS[4],
  "status", "settled",
  "actual_cost_microcredits", actual_tokens,
  "actual_cost_microusd", actual_budget,
  "refund_microcredits", token_refund,
  "refund_microusd", budget_refund,
  "settled_at_ms", now_ms)
redis.call("PEXPIRE", KEYS[4], ttl_ms)

return {1, token_refund, under_reserved and "under_reserved" or "settled"}
