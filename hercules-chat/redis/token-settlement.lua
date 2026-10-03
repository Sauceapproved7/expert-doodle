-- Hercules reservation settlement with integer refill and reservation-bound lease release.
-- KEYS: 1 TPM, 2 concurrency, 3 daily budget for reservation period, 4 monthly budget for reservation period, 5 reservation.
-- ARGV: capacity, refill numerator, refill period ms, actual token microcredits, actual microUSD, TTL.
local cap,num,period=tonumber(ARGV[1]),tonumber(ARGV[2]),tonumber(ARGV[3])
local actual_tokens,actual_budget,ttl=tonumber(ARGV[4]),tonumber(ARGV[5]),tonumber(ARGV[6])
if not cap or cap<1 or not num or num<1 or not period or period<1 then return {-1,0,"invalid_refill_policy"} end
if not actual_tokens or actual_tokens<0 or not actual_budget or actual_budget<0 or not ttl or ttl<1 then return {-1,0,"invalid_settlement"} end
local status=redis.call("HGET",KEYS[5],"status")
if not status then return {0,0,"reservation_not_found"} end
if status=="settled" then return {2,0,"already_settled"} end
if status~="active" then return {0,0,"reservation_not_active"} end
local daily_period=redis.call("HGET",KEYS[5],"daily_period")
local monthly_period=redis.call("HGET",KEYS[5],"monthly_period")
if not daily_period or not monthly_period then return {-1,0,"reservation_period_missing"} end

local reserved_tokens=tonumber(redis.call("HGET",KEYS[5],"reserved_cost_microcredits")) or 0
local reserved_budget=tonumber(redis.call("HGET",KEYS[5],"reserved_cost_microusd")) or 0
local token_refund=math.max(0,reserved_tokens-actual_tokens)
local budget_refund=math.max(0,reserved_budget-actual_budget)
local under=actual_tokens>reserved_tokens or actual_budget>reserved_budget
local rt=redis.call("TIME"); local now=tonumber(rt[1])*1000+math.floor(tonumber(rt[2])/1000)
local v=redis.call("HMGET",KEYS[1],"credits","last_refill_ms","refill_remainder")
local credits,last,rem=tonumber(v[1]),tonumber(v[2]),tonumber(v[3]) or 0
if not credits or not last then credits,last,rem=cap,now,0 end
local elapsed=math.max(0,now-last)
local total=elapsed*num+rem
local add=math.floor(total/period)
local nextrem=total-(add*period)
local refilled=math.min(cap,credits+add)
if refilled==cap then nextrem=0 end
local updated=math.min(cap,refilled+token_refund)
redis.call("HSET",KEYS[1],"credits",updated,"last_refill_ms",now,"refill_remainder",nextrem); redis.call("PEXPIRE",KEYS[1],ttl)

local lease=redis.call("HGET",KEYS[5],"concurrency_lease")
if lease=="1" then
  local c=tonumber(redis.call("GET",KEYS[2])) or 0
  redis.call("SET",KEYS[2],math.max(0,c-1),"PX",ttl)
  redis.call("HSET",KEYS[5],"concurrency_lease","0")
end
if budget_refund>0 then
  local du=tonumber(redis.call("GET",KEYS[3])) or 0
  local mu=tonumber(redis.call("GET",KEYS[4])) or 0
  redis.call("SET",KEYS[3],math.max(0,du-budget_refund),"PX",ttl)
  redis.call("SET",KEYS[4],math.max(0,mu-budget_refund),"PX",ttl)
end
redis.call("HSET",KEYS[5],"status","settled","actual_cost_microcredits",actual_tokens,
  "actual_cost_microusd",actual_budget,"refund_microcredits",token_refund,"refund_microusd",budget_refund,"settled_at_ms",now)
redis.call("PEXPIRE",KEYS[5],ttl)
return {1,token_refund,under and "under_reserved" or "settled"}
