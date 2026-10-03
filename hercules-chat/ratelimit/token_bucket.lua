-- Hercules weighted token bucket
-- KEYS[1] = bucket key
-- ARGV[1] = capacity_microcredits
-- ARGV[2] = refill_microcredits_per_ms
-- ARGV[3] = request_cost_microcredits
-- ARGV[4] = idle_ttl_ms
--
-- Returns:
--   [1, remaining_microcredits, retry_after_ms, reset_after_ms, reason]
-- allowed:
--   1 = reservation admitted and debited
--   0 = reservation denied; capacity remains intact
--  -1 = permanently invalid because request cost exceeds bucket capacity

local bucket_key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local request_cost = tonumber(ARGV[3])
local idle_ttl_ms = tonumber(ARGV[4])

if not capacity or capacity <= 0 then
  return {-1, 0, 0, 0, "INVALID_CAPACITY"}
end

if not refill_per_ms or refill_per_ms < 0 then
  return {-1, 0, 0, 0, "INVALID_REFILL_RATE"}
end

if not request_cost or request_cost < 0 then
  return {-1, 0, 0, 0, "INVALID_REQUEST_COST"}
end

if not idle_ttl_ms or idle_ttl_ms <= 0 then
  return {-1, 0, 0, 0, "INVALID_TTL"}
end

if request_cost > capacity then
  return {-1, 0, 0, 0, "REQUEST_EXCEEDS_CAPACITY"}
end

local clock = redis.call("TIME")
local now_ms = (tonumber(clock[1]) * 1000) + math.floor(tonumber(clock[2]) / 1000)

local stored_tokens = tonumber(redis.call("HGET", bucket_key, "tokens"))
local stored_at = tonumber(redis.call("HGET", bucket_key, "last_ms"))

local tokens = stored_tokens
if tokens == nil then
  tokens = capacity
end

local last_ms = stored_at
if last_ms == nil then
  last_ms = now_ms
end

-- Guard against clock rollback. Redis TIME is authoritative, but keeping
-- last_ms monotonic prevents a rollback from creating artificial credits.
if now_ms < last_ms then
  now_ms = last_ms
end

local elapsed_ms = now_ms - last_ms
if elapsed_ms > 0 and refill_per_ms > 0 then
  tokens = math.min(capacity, tokens + (elapsed_ms * refill_per_ms))
end

if request_cost <= tokens then
  tokens = tokens - request_cost
  redis.call("HSET", bucket_key, "tokens", tokens, "last_ms", now_ms)
  redis.call("PEXPIRE", bucket_key, math.floor(idle_ttl_ms))
  return {1, math.floor(tokens), 0, math.ceil((capacity - tokens) / math.max(refill_per_ms, 0.000000001)), "ADMITTED"}
end

-- A rejected request does not consume credits. Persist only the refreshed
-- balance and timestamp so repeated denials remain deterministic.
redis.call("HSET", bucket_key, "tokens", tokens, "last_ms", now_ms)
redis.call("PEXPIRE", bucket_key, math.floor(idle_ttl_ms))

local deficit = request_cost - tokens
local retry_after_ms = 0
if refill_per_ms > 0 then
  retry_after_ms = math.ceil(deficit / refill_per_ms)
end

local reset_after_ms = 0
if refill_per_ms > 0 then
  reset_after_ms = math.ceil((capacity - tokens) / refill_per_ms)
end

return {0, math.floor(tokens), retry_after_ms, reset_after_ms, "RATE_LIMITED"}
