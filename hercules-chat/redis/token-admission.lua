-- Hercules weighted AI admission gate (integer refill + period-safe budgets).
-- KEYS: 1 TPM, 2 RPM, 3 concurrency, 4 daily budget, 5 monthly budget, 6 reservation.
-- ARGV: TPM cap,num,period,cost; RPM cap,num,period; max concurrency; TTL;
-- daily limit; monthly limit; daily period; monthly period; reserved microUSD; request id; tenant fingerprint.

local function n(i) return tonumber(ARGV[i]) end
local tcap, tnum, tperiod, cost = n(1), n(2), n(3), n(4)
local rcap, rnum, rperiod = n(5), n(6), n(7)
local maxc, ttl = n(8), n(9)
local dlimit, mlimit = n(10), n(11)
local dperiod, mperiod = ARGV[12], ARGV[13]
local bcost, request_id, tenant = n(14), ARGV[15], ARGV[16]

if not tcap or tcap < 1 then return {-1,0,0,0,"invalid_tpm_capacity"} end
if not tnum or tnum < 1 or not tperiod or tperiod < 1 then return {-1,0,0,0,"invalid_tpm_refill"} end
if not cost or cost < 1 then return {-1,0,0,0,"invalid_request_cost"} end
if not rcap or rcap < 1 then return {-1,0,0,0,"invalid_rpm_capacity"} end
if not rnum or rnum < 1 or not rperiod or rperiod < 1 then return {-1,0,0,0,"invalid_rpm_refill"} end
if not maxc or maxc < 1 or not ttl or ttl < 1 then return {-1,0,0,0,"invalid_policy"} end
if not dlimit or dlimit < 0 or not mlimit or mlimit < 0 or not bcost or bcost < 0 then return {-1,0,0,0,"invalid_budget"} end
if not dperiod or dperiod == "" or not mperiod or mperiod == "" then return {-1,0,0,0,"invalid_period"} end
if not request_id or request_id == "" or not tenant or tenant == "" then return {-1,0,0,0,"invalid_identity"} end
if cost > tcap then return {-1,0,0,0,"request_exceeds_burst_capacity"} end

local status=redis.call("HGET",KEYS[6],"status")
if status then
  if (redis.call("HGET",KEYS[6],"tenant_fingerprint") or "") ~= tenant then return {-1,0,0,0,"reservation_tenant_mismatch"} end
  if status=="active" then return {2,0,0,0,"idempotent_active",tonumber(redis.call("HGET",KEYS[6],"reserved_cost_microcredits")) or 0} end
  return {-1,0,0,0,"reservation_already_settled"}
end

local rt=redis.call("TIME")
local now=tonumber(rt[1])*1000+math.floor(tonumber(rt[2])/1000)

local function bucket(key,cap,num,period)
  local v=redis.call("HMGET",key,"credits","last_refill_ms","refill_remainder")
  local credits,last,rem=tonumber(v[1]),tonumber(v[2]),tonumber(v[3]) or 0
  if not credits or not last then credits,last,rem=cap,now,0 end
  local elapsed=math.max(0,now-last)
  local total=elapsed*num+rem
  local add=math.floor(total/period)
  local nextrem=total-(add*period)
  local refilled=math.min(cap,credits+add)
  if refilled==cap then nextrem=0 end
  return refilled,nextrem
end

local ta,tr=bucket(KEYS[1],tcap,tnum,tperiod)
local ra,rr=bucket(KEYS[2],rcap,rnum,rperiod)
local conc=tonumber(redis.call("GET",KEYS[3])) or 0
local du=tonumber(redis.call("GET",KEYS[4])) or 0
local mu=tonumber(redis.call("GET",KEYS[5])) or 0

if ta < cost then return {0,ta,math.ceil((cost-ta)*tperiod/tnum),0,"token_rate_limited"} end
if ra < 1 then return {0,ta,math.ceil(rperiod/rnum),0,"request_rate_limited"} end
if conc >= maxc then return {0,ta,1000,0,"concurrency_limited"} end
if dlimit > 0 and du+bcost>dlimit then return {0,ta,0,0,"daily_budget_exceeded"} end
if mlimit > 0 and mu+bcost>mlimit then return {0,ta,0,0,"monthly_budget_exceeded"} end

local trem=ta-cost
local rrem=ra-1
redis.call("HSET",KEYS[1],"credits",trem,"last_refill_ms",now,"refill_remainder",tr); redis.call("PEXPIRE",KEYS[1],ttl)
redis.call("HSET",KEYS[2],"credits",rrem,"last_refill_ms",now,"refill_remainder",rr); redis.call("PEXPIRE",KEYS[2],ttl)
redis.call("SET",KEYS[3],conc+1,"PX",ttl)
redis.call("SET",KEYS[4],du+bcost,"PX",ttl)
redis.call("SET",KEYS[5],mu+bcost,"PX",ttl)
redis.call("HSET",KEYS[6],"status","active","tenant_fingerprint",tenant,"request_id",request_id,
  "reserved_cost_microcredits",cost,"reserved_cost_microusd",bcost,"reserved_at_ms",now,
  "daily_period",dperiod,"monthly_period",mperiod,"concurrency_lease","1")
redis.call("PEXPIRE",KEYS[6],ttl)
return {1,trem,0,math.ceil((tcap-trem)*tperiod/tnum),"allowed",conc+1}
