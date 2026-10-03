-- Hercules weighted AI admission gate. All keys share one tenant hash slot.
-- KEYS: 1 TPM, 2 RPM, 3 concurrency, 4 daily budget, 5 monthly budget, 6 reservation, 7 lease index.
-- ARGV: 1 TPM capacity, 2 TPM refill/min, 3 request cost, 4 RPM capacity, 5 RPM refill/min,
-- 6 max concurrent, 7 reservation TTL ms, 8 daily limit, 9 monthly limit,
-- 10 daily period, 11 monthly period, 12 reserved microUSD, 13 request id, 14 tenant fingerprint.
local function integer(v,min) return v and v>=min and v==math.floor(v) and v<9007199254740992 end
local tpm_capacity=tonumber(ARGV[1]); local tpm_rate=tonumber(ARGV[2]); local cost=tonumber(ARGV[3])
local rpm_capacity=tonumber(ARGV[4]); local rpm_rate=tonumber(ARGV[5]); local max_concurrent=tonumber(ARGV[6])
local ttl_ms=tonumber(ARGV[7]); local daily_limit=tonumber(ARGV[8]); local monthly_limit=tonumber(ARGV[9])
local daily_period=ARGV[10]; local monthly_period=ARGV[11]; local budget_cost=tonumber(ARGV[12])
local request_id=ARGV[13]; local tenant=ARGV[14]
if not integer(tpm_capacity,1) then return {-1,0,0,0,"invalid_tpm_capacity"} end
if not integer(tpm_rate,1) then return {-1,0,0,0,"invalid_tpm_refill"} end
if not integer(cost,1) then return {-1,0,0,0,"invalid_request_cost"} end
if not integer(rpm_capacity,1) then return {-1,0,0,0,"invalid_rpm_capacity"} end
if not integer(rpm_rate,1) then return {-1,0,0,0,"invalid_rpm_refill"} end
if not integer(max_concurrent,1) then return {-1,0,0,0,"invalid_max_concurrent"} end
if not integer(ttl_ms,1) then return {-1,0,0,0,"invalid_reservation_ttl"} end
if not integer(daily_limit,0) then return {-1,0,0,0,"invalid_daily_budget"} end
if not integer(monthly_limit,0) then return {-1,0,0,0,"invalid_monthly_budget"} end
if not integer(budget_cost,0) then return {-1,0,0,0,"invalid_budget_cost"} end
if not request_id or request_id=="" then return {-1,0,0,0,"invalid_request_id"} end
if not tenant or tenant=="" then return {-1,0,0,0,"invalid_tenant_fingerprint"} end
if not daily_period or daily_period=="" then return {-1,0,0,0,"invalid_daily_period"} end
if not monthly_period or monthly_period=="" then return {-1,0,0,0,"invalid_monthly_period"} end
if cost>tpm_capacity then return {-1,0,0,0,"request_exceeds_burst_capacity"} end
local existing=redis.call("HGET",KEYS[6],"status")
if existing then
  if (redis.call("HGET",KEYS[6],"tenant_fingerprint") or "")~=tenant then return {-1,0,0,0,"reservation_tenant_mismatch"} end
  if existing=="active" then return {2,0,0,0,"idempotent_active",tonumber(redis.call("HGET",KEYS[6],"reserved_cost_microcredits")) or 0} end
  return {-1,0,0,0,"reservation_already_settled"}
end
local rt=redis.call("TIME"); local now=tonumber(rt[1])*1000+math.floor(tonumber(rt[2])/1000)
local function safe_refill(elapsed,rate)\n  local whole=math.floor(elapsed/60000); local rem=elapsed-whole*60000\n  return whole*rate+math.floor(rem*rate/60000)\nend\nlocal function bucket(key,capacity,rate)
  local v=redis.call("HMGET",key,"credits","last_refill_ms"); local credits=tonumber(v[1]); local last=tonumber(v[2])
  if not credits or not last then credits=capacity; last=now end
  local elapsed=math.max(0,now-last)
  local max_elapsed=math.ceil(capacity*60000/rate)
  elapsed=math.min(elapsed,max_elapsed)
  local refill=safe_refill(elapsed,rate)
  return math.min(capacity,credits+refill)
end
local tpm=bucket(KEYS[1],tpm_capacity,tpm_rate); local rpm=bucket(KEYS[2],rpm_capacity,rpm_rate)
redis.call("ZREMRANGEBYSCORE",KEYS[7],"-inf",now)\nlocal concurrency=tonumber(redis.call("ZCARD",KEYS[7])) or 0
local daily_used=tonumber(redis.call("GET",KEYS[4])) or 0; local monthly_used=tonumber(redis.call("GET",KEYS[5])) or 0
if tpm<cost then return {0,tpm,math.ceil((cost-tpm)*60000/tpm_rate),0,"token_rate_limited"} end
if rpm<1 then return {0,tpm,math.ceil(60000/rpm_rate),0,"request_rate_limited"} end
if concurrency>=max_concurrent then return {0,tpm,1000,0,"concurrency_limited"} end
if daily_limit>0 and daily_used+budget_cost>daily_limit then return {0,tpm,0,0,"daily_budget_exceeded"} end
if monthly_limit>0 and monthly_used+budget_cost>monthly_limit then return {0,tpm,0,0,"monthly_budget_exceeded"} end
local remaining=tpm-cost; local lease=now+ttl_ms
redis.call("HSET",KEYS[1],"credits",remaining,"last_refill_ms",now); redis.call("PEXPIRE",KEYS[1],ttl_ms)
redis.call("HSET",KEYS[2],"credits",rpm-1,"last_refill_ms",now); redis.call("PEXPIRE",KEYS[2],ttl_ms)
redis.call("SET",KEYS[3],concurrency+1,"PX",ttl_ms)
redis.call("SET",KEYS[4],daily_used+budget_cost,"PX",ttl_ms); redis.call("SET",KEYS[5],monthly_used+budget_cost,"PX",ttl_ms)
redis.call("HSET",KEYS[6],"status","active","tenant_fingerprint",tenant,"request_id",request_id,
 "reserved_cost_microcredits",cost,"reserved_cost_microusd",budget_cost,"daily_period",daily_period,
 "monthly_period",monthly_period,"reserved_at_ms",now,"lease_expires_at_ms",lease)
redis.call("PEXPIRE",KEYS[6],ttl_ms*2)
redis.call("ZADD",KEYS[7],lease,request_id)
return {1,remaining,0,math.ceil((tpm_capacity-remaining)*60000/tpm_rate),"allowed",concurrency+1}
