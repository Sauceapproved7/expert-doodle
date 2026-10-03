-- Compatibility token bucket retained for the Hercules chat owner-code verifier.
-- New production hardening uses hercules-chat/redis/token-admission.lua.
local capacity=tonumber(ARGV[1])
local refill_per_ms=tonumber(ARGV[2])
local request_cost=tonumber(ARGV[3])
local ttl_ms=tonumber(ARGV[4])
if not capacity or capacity<=0 or not refill_per_ms or refill_per_ms<=0 or not request_cost or request_cost<=0 or not ttl_ms or ttl_ms<=0 then
  return -1,0,0,0,"invalid"
end
if request_cost>capacity then return -1,0,0,0,"request_exceeds_capacity" end
local t=redis.call("TIME")
local now_ms=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
local raw=redis.call("GET",KEYS[1])
local credits=capacity
local last=now_ms
if raw then
 local sep=string.find(raw,":")
 credits=tonumber(string.sub(raw,1,sep-1)) or capacity
 last=tonumber(string.sub(raw,sep+1)) or now_ms
end
local available=math.min(capacity,credits+math.max(0,now_ms-last)*refill_per_ms)
local retry_after_ms=0
local reset_after_ms=math.ceil((capacity-available)/refill_per_ms)
if available<request_cost then
 retry_after_ms=math.ceil((request_cost-available)/refill_per_ms)
 return 0,available,retry_after_ms,reset_after_ms,"token_rate_limited"
end
local remaining=available-request_cost
redis.call("SET",KEYS[1],remaining..":"..now_ms)
redis.call("PEXPIRE",KEYS[1],ttl_ms)
return 1,remaining,retry_after_ms,math.ceil((capacity-remaining)/refill_per_ms),"allowed"
