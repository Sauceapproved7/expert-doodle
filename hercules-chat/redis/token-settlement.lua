-- Hercules AI reservation settlement.
-- KEYS: 1 TPM, 2 concurrency, 3 daily budget, 4 monthly budget, 5 reservation, 6 lease index.
-- ARGV: 1 capacity, 2 refill/min, 3 actual token cost, 4 actual microUSD, 5 ttl ms,
-- 6 daily period, 7 monthly period, 8 request id.
local capacity=tonumber(ARGV[1]); local rate=tonumber(ARGV[2]); local actual=tonumber(ARGV[3])
local actual_budget=tonumber(ARGV[4]); local ttl=tonumber(ARGV[5]); local daily=ARGV[6]; local monthly=ARGV[7]; local request_id=ARGV[8]
local function integer(v,min) return v and v>=min and v==math.floor(v) and v<9007199254740992 end
if not integer(capacity,1) then return {-1,0,"invalid_capacity"} end
if not integer(rate,1) then return {-1,0,"invalid_refill_rate"} end
if not integer(actual,0) then return {-1,0,"invalid_actual_tokens"} end
if not integer(actual_budget,0) then return {-1,0,"invalid_actual_budget"} end
if not integer(ttl,1) then return {-1,0,"invalid_ttl"} end
local status=redis.call("HGET",KEYS[5],"status")
if not status then return {0,0,"reservation_not_found"} end
if status=="settled" then return {2,0,"already_settled"} end
if status~="active" then return {0,0,"reservation_not_active"} end
if redis.call("HGET",KEYS[5],"daily_period")~=daily or redis.call("HGET",KEYS[5],"monthly_period")~=monthly then return {-1,0,"reservation_period_mismatch"} end
local reserved=tonumber(redis.call("HGET",KEYS[5],"reserved_cost_microcredits")) or 0
local reserved_budget=tonumber(redis.call("HGET",KEYS[5],"reserved_cost_microusd")) or 0
local token_refund=math.max(0,reserved-actual); local budget_refund=math.max(0,reserved_budget-actual_budget)
local under=actual>reserved or actual_budget>reserved_budget
local rt=redis.call("TIME"); local now=tonumber(rt[1])*1000+math.floor(tonumber(rt[2])/1000)
local v=redis.call("HMGET",KEYS[1],"credits","last_refill_ms"); local credits=tonumber(v[1]) or capacity; local last=tonumber(v[2]) or now
local elapsed=math.min(math.max(0,now-last),math.ceil(capacity*60000/rate))
local function safe_refill(elapsed_ms,refill_rate)\n local whole=math.floor(elapsed_ms/60000); local rem=elapsed_ms-whole*60000\n return whole*refill_rate+math.floor(rem*refill_rate/60000)\nend\nlocal refilled=math.min(capacity,credits+safe_refill(elapsed,rate))
redis.call("HSET",KEYS[1],"credits",math.min(capacity,refilled+token_refund),"last_refill_ms",now); redis.call("PEXPIRE",KEYS[1],ttl)
if budget_refund>0 then
 local du=tonumber(redis.call("GET",KEYS[3])) or 0; local mu=tonumber(redis.call("GET",KEYS[4])) or 0
 redis.call("SET",KEYS[3],math.max(0,du-budget_refund),"PX",ttl); redis.call("SET",KEYS[4],math.max(0,mu-budget_refund),"PX",ttl)
end
redis.call("HSET",KEYS[5],"status","settled","actual_cost_microcredits",actual,"actual_cost_microusd",actual_budget,
 "refund_microcredits",token_refund,"refund_microusd",budget_refund,"settled_at_ms",now)
redis.call("PEXPIRE",KEYS[5],ttl); redis.call("ZREM",KEYS[6],request_id)
return {1,token_refund,under and "under_reserved" or "settled"}
