import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {RedisAiAdmissionController, buildAdmissionKeys} from "../hercules-chat/redis/admission.mjs";

const enabled=process.env.HERCULES_REDIS_INTEGRATION==="1";
function redis(...args){const out=execFileSync("redis-cli",["--json",...args],{encoding:"utf8"}).trim(); return out?JSON.parse(out):null;}
const client={
 async scriptLoad(script){return redis("SCRIPT","LOAD",script);},
 async evalsha(sha,keyCount,...rest){return redis("EVALSHA",sha,String(keyCount),...rest.map(String));}
};
const base={tenantId:"integration-tenant",tpmCapacityMicrocredits:60000000,tpmRefillMicrocreditsPerMinute:120000000,
 rpmCapacity:60,rpmRefillRequestsPerMinute:60,maxConcurrent:2,reservationTtlMs:2000,dailyBudgetMicrousd:100000,
 monthlyBudgetMicrousd:1000000,dailyPeriod:"2026-10-03",monthlyPeriod:"2026-10",reservedCostMicrousd:1000};

test("real Redis admission is atomic, idempotent, period-scoped, and settles once",{skip:!enabled},async()=>{
 redis("FLUSHDB"); const ctl=new RedisAiAdmissionController(client);
 const input={...base,requestId:"req-real-1",requestCostMicrocredits:6250000};
 const first=await ctl.admit(input); assert.equal(first.status,"allowed");
 const replay=await ctl.admit(input); assert.equal(replay.status,"idempotent_active");
 const keys=buildAdmissionKeys(input.tenantId,input.requestId,input.dailyPeriod,input.monthlyPeriod);
 assert.equal(Number(redis("GET",keys.dailyBudget)), 1000); assert.equal(Number(redis("GET",keys.monthlyBudget)), 1000);
 const settled=await ctl.settle({...input,actualCostMicrocredits:5000000,actualCostMicrousd:600});
 assert.equal(settled.status,"settled"); assert.equal(Number(redis("GET",keys.dailyBudget)), 600);
 const duplicate=await ctl.settle({...input,actualCostMicrocredits:5000000,actualCostMicrousd:600});
 assert.equal(duplicate.status,"already_settled");
});

test("real Redis cleanup releases only an expired active concurrency lease",{skip:!enabled},async()=>{
 redis("FLUSHDB"); const ctl=new RedisAiAdmissionController(client);
 const input={...base,requestId:"req-expire",requestCostMicrocredits:1000,reservationTtlMs:50};
 await ctl.admit(input); const keys=buildAdmissionKeys(input.tenantId,input.requestId,input.dailyPeriod,input.monthlyPeriod);
 assert.equal(Number(redis("GET",keys.concurrency)), 1);
 await new Promise(r=>setTimeout(r,80));
 const cleaned=await ctl.cleanupExpired({...input,reservationTtlMs:2000});
 assert.equal(cleaned.status,"expired"); assert.equal(Number(redis("GET",keys.concurrency)), 0);
 const again=await ctl.cleanupExpired({...input,reservationTtlMs:2000}); assert.equal(again.status,"already_final");
});
