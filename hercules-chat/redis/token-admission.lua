-- Hercules weighted AI admission gate.
-- KEYS[1] tpm bucket, KEYS[2] rpm bucket, KEYS[3] concurrency,
-- KEYS[4] budget, KEYS[5] reservation.
-- All keys must share the tenant hash tag in Redis Cluster.
--
-- ARGV:
-- 1 tpm capacity microcredits
-- 2 tpm refill microcredits/ms
-- 3 request token cost microcredits
-- 4 rpm capacity requests
-- 5 rpm refill requests/ms
-- 6 max concurrent requests
-- 7 reservation ttl ms
-- 8 daily budget microUSD (0 disables)
-- 9 monthly budget microUSD (0 disables)
-- 10 daily period id
-- 11 monthly period id
-- 12 reserved cost microUSD
-- 13 request id
-- 14 opaque tenant fingerprint

local function invalid(value, minimum)
  return value == nil or value < minimum
end

local tpm_capacity = tonumber(ARGV[1])
local tpm_refill = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local rpm_capacity = tonumber(ARGV[4])
local rpm_refill = tonumber(ARGV[5])
local max_concurrent = tonumber(ARGV[6])
local ttl_ms = tonumber(ARGV[7])
local daily_budget = tonumber(ARGV[8])
local monthly_budget = tonumber(ARGV[9])
local daily_period = ARGV[10]
local monthly_period = ARGV[11]
local budget_cost = tonumber(ARGV[12])
local request_id = ARGV[13]
local tenant_fingerprint = ARGV[14]

if invalid(tpm_capacity, 1) then return {-1, 0, 0, 0, "invalid_tpm_capacity"} end
if invalid(tpm_refill, 0) or tpm_refill == 0 then return {-1, 0, 0, 0, "invalid_tpm_refill"} end
if invalid(cost, 1) then return {-1, 0, 0, 0, "invalid_request_cost"} end
if invalid(rpm_capacity, 1) then return {-1, 0, 0, 0, "invalid_rpm_capacity"} end
if invalid(rpm_refill, 0) or rpm_refill == 0 then return {-1, 0, 0, 0, "invalid_rpm_refill"} end
if invalid(max_concurrent, 1) then return {-1, 0, 0, 0, "invalid_max_concurrent"} end
if invalid(ttl_ms, 1) then return {-1, 0, 0, 0, "invalid_reservation_ttl"} end
if daily_budget == nil or daily_budget < 0 then return {-1, 0, 0, 0, "invalid_daily_budget"} end
if monthly_budget == nil or monthly_budget < 0 then return {-1, 0, 0, 0, "invalid_monthly_budget"} end
if invalid(budget_cost, 0) then return {-1, 0, 0, 0, "invalid_budget_cost"} end
if not request_id or request_id == "" then return {-1, 0, 0, 0, "invalid_request_id"} end
if not tenant_fingerprint or tenant_fingerprint == "" then return {-1, 0, 0, 0, "invalid_tenant_fingerprint"} end
if not daily_period or daily_period == "" then return {-1, 0, 0, 0, "invalid_daily_period"} end
if not monthly_period or monthly_period == "" then return {-1, 0, 0, 0, "invalid_monthly_period"} end
if cost > tpm_capacity then return {-1, 0, 0, 0, "request_exceeds_burst_capacity"} end

local existing_status = redis.call("HGET", KEYS[5], "status")
if existing_status then
  local existing_cost = tonumber(redis.call("HGET", KEYS[5], "reserved_cost_microcredits")) or 0
  local existing_tenant = redis.call("HGET", KEYS[5], "tenant_fingerprint") or ""
  if existing_tenant ~= tenant_fingerprint then
    return {-1, 0, 0, 0, "reservation_tenant_mismatch"}
  end
  if existing_status == "active" then
    return {2, 0, 0, 0, "idempotent_active", existing_cost}
  end
  return {-1, 0, 0, 0, "reservation_already_settled"}
end

local redis_time = redis.call("TIME")
local now_ms = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)

local function bucket_state(key, capacity, refill_per_ms)
  local values = redis.call("HMGET", key, "credits", "last_refill_ms")
  local credits = tonumber(values[1])
  local last = tonumber(values[2])
  if credits == nil or last == nil then
    credits = capacity
    last = now_ms
  end
  local elapsed = math.max(0, now_ms - last)
  local refilled = math.min(capacity, credits + elapsed * refill_per_ms)
  return refilled, math.ceil((capacity - refilled) / refill_per_ms)
end

local tpm_available, tpm_reset = bucket_state(KEYS[1], tpm_capacity, tpm_refill)
local rpm_available, rpm_reset = bucket_state(KEYS[2], rpm_capacity, rpm_refill)
local concurrency = tonumber(redis.call("GET", KEYS[3])) or 0
local budget = redis.call("HMGET", KEYS[4], "daily_period", "daily_used", "monthly_period", "monthly_used")
local stored_daily_period = budget[1]
local daily_used = tonumber(budget[2]) or 0
local stored_monthly_period = budget[3]
local monthly_used = tonumber(budget[4]) or 0

if stored_daily_period ~= daily_period then daily_used = 0 end
if stored_monthly_period ~= monthly_period then monthly_used = 0 end

if tpm_available < cost then
  return {0, tpm_available, math.ceil((cost - tpm_available) / tpm_refill), tpm_reset, "token_rate_limited"}
end
if rpm_available < 1 then
  return {0, tpm_available, math.max(1, math.ceil((1 - rpm_available) / rpm_refill)), rpm_reset, "request_rate_limited"}
end
if concurrency >= max_concurrent then
  return {0, tpm_available, 1000, 0, "concurrency_limited"}
end
if daily_budget > 0 and daily_used + budget_cost > daily_budget then
  return {0, tpm_available, 0, 0, "daily_budget_exceeded"}
end
if monthly_budget > 0 and monthly_used + budget_cost > monthly_budget then
  return {0, tpm_available, 0, 0, "monthly_budget_exceeded"}
end

local remaining_tpm = tpm_available - cost
local remaining_rpm = rpm_available - 1

redis.call("HSET", KEYS[1], "credits", remaining_tpm, "last_refill_ms", now_ms)
redis.call("PEXPIRE", KEYS[1], ttl_ms)
redis.call("HSET", KEYS[2], "credits", remaining_rpm, "last_refill_ms", now_ms)
redis.call("PEXPIRE", KEYS[2], ttl_ms)
redis.call("SET", KEYS[3], concurrency + 1, "PX", ttl_ms)

redis.call("HSET", KEYS[4],
  "daily_period", daily_period,
  "daily_used", daily_used + budget_cost,
  "monthly_period", monthly_period,
  "monthly_used", monthly_used + budget_cost)
redis.call("PEXPIRE", KEYS[4], ttl_ms)

redis.call("HSET", KEYS[5],
  "status", "active",
  "tenant_fingerprint", tenant_fingerprint,
  "request_id", request_id,
  "reserved_cost_microcredits", cost,
  "reserved_cost_microusd", budget_cost,
  "reserved_at_ms", now_ms)
redis.call("PEXPIRE", KEYS[5], ttl_ms)

return {1, remaining_tpm, 0, math.ceil((tpm_capacity - remaining_tpm) / tpm_refill), "allowed", concurrency + 1}
