-- Hercules weighted token bucket.
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
local tokens = tonumber(redis.call("GET", key .. ":tokens"))
local last = tonumber(redis.call("GET", key .. ":last_ms"))
if tokens == nil then tokens = capacity end
if last == nil then last = now end
if now < last then now = last end

local elapsed = now - last
if elapsed > 0 and refill_per_ms > 0 then
  tokens = math.min(capacity, tokens + elapsed * refill_per_ms)
end

local retry_after_ms = 0
local reset_after_ms = 0
if request_cost <= tokens then
  tokens = tokens - request_cost
  redis.call("SET", key .. ":tokens", tokens)
  redis.call("SET", key .. ":last_ms", now)
  redis.call("PEXPIRE", key .. ":tokens", math.floor(ttl_ms))
  redis.call("PEXPIRE", key .. ":last_ms", math.floor(ttl_ms))
  reset_after_ms = refill_per_ms > 0 and math.ceil((capacity - tokens) / refill_per_ms) or 0
  return 1, math.floor(tokens), retry_after_ms, reset_after_ms, "ADMITTED"
end

redis.call("SET", key .. ":tokens", tokens)
redis.call("SET", key .. ":last_ms", now)
redis.call("PEXPIRE", key .. ":tokens", math.floor(ttl_ms))
redis.call("PEXPIRE", key .. ":last_ms", math.floor(ttl_ms))
retry_after_ms = refill_per_ms > 0 and math.ceil((request_cost - tokens) / refill_per_ms) or 0
reset_after_ms = refill_per_ms > 0 and math.ceil((capacity - tokens) / refill_per_ms) or 0
return 0, math.floor(tokens), retry_after_ms, reset_after_ms, "RATE_LIMITED"
