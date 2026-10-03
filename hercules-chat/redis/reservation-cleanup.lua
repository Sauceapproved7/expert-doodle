-- Hercules abandoned reservation cleanup.
-- KEYS[1] concurrency, KEYS[2] reservation, KEYS[3] lease index.
-- ARGV: 1 request id, 2 key ttl ms.
local request_id=ARGV[1]
local ttl_ms=tonumber(ARGV[2])
if not request_id or request_id=="" then return {-1,"invalid_request_id"} end
if not ttl_ms or ttl_ms<=0 then return {-1,"invalid_ttl"} end
local status=redis.call("HGET",KEYS[2],"status")
if not status then redis.call("ZREM",KEYS[3],request_id); return {0,"reservation_not_found"} end
if status~="active" then redis.call("ZREM",KEYS[3],request_id); return {2,"already_final"} end
local lease=tonumber(redis.call("HGET",KEYS[2],"lease_expires_at_ms")) or 0
local t=redis.call("TIME")
local now_ms=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
if lease>now_ms then return {0,"lease_not_expired"} end
redis.call("HSET",KEYS[2],"status","expired","expired_at_ms",now_ms)
redis.call("PEXPIRE",KEYS[2],ttl_ms)
redis.call("ZREM",KEYS[3],request_id)
return {1,"expired"}
