-- Reap an abandoned Hercules reservation after its lease age.
-- KEYS: 1 TPM, 2 concurrency, 3 daily budget, 4 monthly budget, 5 reservation.
-- ARGV: capacity, refill numerator, refill period ms, minimum age ms, TTL.
local cap,num,period,min_age,ttl=tonumber(ARGV[1]),tonumber(ARGV[2]),tonumber(ARGV[3]),tonumber(ARGV[4]),tonumber(ARGV[5])
if not cap or cap<1 or not num or num<1 or not period or period<1 or not min_age or min_age<1 or not ttl or ttl<1 then return {-1,0,"invalid_reap_policy"} end
local status=redis.call("HGET",KEYS[5],"status")
if not status then return {0,0,"reservation_not_found"} end
if status~="active" then return {2,0,"reservation_not_active"} end
local rt=redis.call("TIME"); local now=tonumber(rt[1])*1000+math.floor(tonumber(rt[2])/1000)
local reserved_at=tonumber(redis.call("HGET",KEYS[5],"reserved_at_ms")) or now
if now-reserved_at < min_age then return {0,0,"reservation_not_expired"} end
local reserved_tokens=tonumber(redis.call("HGET",KEYS[5],"reserved_cost_microcredits")) or 0
local reserved_budget=tonumber(redis.call("HGET",KEYS[5],"reserved_cost_microusd")) or 0
local v=redis.call("HMGET",KEYS[1],"credits","last_refill_ms","refill_remainder")
local credits,last,rem=tonumber(v[1]),tonumber(v[2]),tonumber(v[3]) or 0
if not credits or not last then credits,last,rem=cap,now,0 end
local elapsed=math.max(0,now-last); local total=elapsed*num+rem
local add=math.floor(total/period); local nextrem=total-(add*period)
local refilled=math.min(cap,credits+add); if refilled==cap then nextrem=0 end
local updated=math.min(cap,refilled+reserved_tokens)
redis.call("HSET",KEYS[1],"credits",updated,"last_refill_ms",now,"refill_remainder",nextrem); redis.call("PEXPIRE",KEYS[1],ttl)
if redis.call("HGET",KEYS[5],"concurrency_lease")=="1" then
  local c=tonumber(redis.call("GET",KEYS[2])) or 0
  redis.call("SET",KEYS[2],math.max(0,c-1),"PX",ttl)
  redis.call("HSET",KEYS[5],"concurrency_lease","0")
end
local du=tonumber(redis.call("GET",KEYS[3])) or 0; local mu=tonumber(redis.call("GET",KEYS[4])) or 0
redis.call("SET",KEYS[3],math.max(0,du-reserved_budget),"PX",ttl)
redis.call("SET",KEYS[4],math.max(0,mu-reserved_budget),"PX",ttl)
redis.call("HSET",KEYS[5],"status","expired","expired_at_ms",now,"refund_microcredits",reserved_tokens,"refund_microusd",reserved_budget)
redis.call("PEXPIRE",KEYS[5],ttl)
return {1,reserved_tokens,"expired"}
