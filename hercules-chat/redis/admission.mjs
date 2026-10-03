import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

const ADMISSION_LUA = await readFile(new URL("./token-admission.lua", import.meta.url), "utf8");
const SETTLEMENT_LUA = await readFile(new URL("./token-settlement.lua", import.meta.url), "utf8");
const REAP_LUA = await readFile(new URL("./token-reap.lua", import.meta.url), "utf8");

const ADMISSION_REASONS = new Set(["allowed","idempotent_active","token_rate_limited","request_rate_limited","concurrency_limited","daily_budget_exceeded","monthly_budget_exceeded","request_exceeds_burst_capacity","reservation_tenant_mismatch","reservation_already_settled"]);
const SETTLEMENT_REASONS = new Set(["settled","already_settled","reservation_not_found","reservation_not_active","under_reserved"]);

function fingerprint(value) {
  const input=String(value??"").trim();
  if(!input) throw new TypeError("tenantId is required");
  return createHash("sha256").update(input).digest("hex").slice(0,32);
}
function requestKey(value) {
  const input=String(value??"").trim();
  if(!input||input.length>200||/[\\s{}]/.test(input)) throw new TypeError("requestId must be a bounded key-safe identifier");
  return input;
}
function periodKey(value,name) {
  const input=String(value??"").trim();
  if(!input||input.length>32||/[\\s{}:]/.test(input)) throw new TypeError(`${name} is required and must be key-safe`);
  return input;
}
function hashTag(tenantId){return "t:"+fingerprint(tenantId);}

export function buildAdmissionKeys(tenantId,requestId,periods={}) {
  const tag=hashTag(tenantId), request=requestKey(requestId);
  const daily=periodKey(periods.dailyPeriod,"dailyPeriod"), monthly=periodKey(periods.monthlyPeriod,"monthlyPeriod");
  return {
    tpm:`rl:{${tag}}:tpm`, rpm:`rl:{${tag}}:rpm`, concurrency:`rl:{${tag}}:concurrency`,
    dailyBudget:`rl:{${tag}}:budget:day:${daily}`, monthlyBudget:`rl:{${tag}}:budget:month:${monthly}`,
    reservation:`rl:{${tag}}:reservation:${request}`,
  };
}
export function buildSettlementKeys(tenantId,requestId,periods={}) {
  const k=buildAdmissionKeys(tenantId,requestId,periods);
  return {tpm:k.tpm,concurrency:k.concurrency,dailyBudget:k.dailyBudget,monthlyBudget:k.monthlyBudget,reservation:k.reservation};
}
function refillRatio(explicitNumerator,explicitPeriodMs,legacyPerMs,name) {
  if(explicitNumerator!=null||explicitPeriodMs!=null){
    const numerator=Number(explicitNumerator), periodMs=Number(explicitPeriodMs);
    if(!Number.isSafeInteger(numerator)||numerator<1||!Number.isSafeInteger(periodMs)||periodMs<1) throw new TypeError(`${name} refill ratio must use positive safe integers`);
    return [numerator,periodMs];
  }
  const raw=String(legacyPerMs??"");
  if(!/^(?:\\d+)(?:\\.\\d+)?$/.test(raw)) throw new TypeError(`${name} refill ratio is required`);
  const [whole,fraction=""]=raw.split("."), denominator=10**fraction.length;
  const numerator=Number(whole)*denominator+Number(fraction||0);
  if(!Number.isSafeInteger(numerator)||numerator<1||!Number.isSafeInteger(denominator)) throw new TypeError(`${name} refill ratio is outside safe integer bounds`);
  return [numerator,denominator];
}
function assertArray(result,name){if(!Array.isArray(result)||result.length<5) throw new Error(`invalid ${name} result`);}

export function decodeAdmissionResult(result){
  assertArray(result,"admission"); const code=Number(result[0]), reason=String(result[4]);
  if(!ADMISSION_REASONS.has(reason)) throw new Error(`unknown admission result: ${reason}`);
  if(code===1) return {status:"allowed",remainingMicrocredits:Number(result[1]),retryAfterMs:Number(result[2]),resetAfterMs:Number(result[3]),concurrency:Number(result[5]),isNewReservation:true};
  if(code===2&&reason==="idempotent_active") return {status:"idempotent_active",remainingMicrocredits:0,retryAfterMs:0,resetAfterMs:0,concurrency:0,isNewReservation:false};
  if(code===-1) return {status:"permanent_rejection",reason,remainingMicrocredits:Number(result[1]),retryAfterMs:Number(result[2]),resetAfterMs:Number(result[3]),concurrency:0,isNewReservation:false};
  if(code===0) return {status:reason,remainingMicrocredits:Number(result[1]),retryAfterMs:Number(result[2]),resetAfterMs:Number(result[3]),concurrency:0,isNewReservation:false};
  throw new Error(`invalid admission result code for ${reason}`);
}
export function decodeSettlementResult(result){
  if(!Array.isArray(result)||result.length<3) throw new Error("invalid settlement result");
  const code=Number(result[0]), refundMicrocredits=Number(result[1]), reason=String(result[2]);
  if(!SETTLEMENT_REASONS.has(reason)) throw new Error(`unknown settlement result: ${reason}`);
  if(code===1&&reason==="settled") return {status:"settled",refundMicrocredits,underReserved:false};
  if(code===1&&reason==="under_reserved") return {status:"under_reserved",refundMicrocredits,underReserved:true};
  if(code===2&&reason==="already_settled") return {status:"already_settled",refundMicrocredits,underReserved:false};
  if(code===0) return {status:reason,refundMicrocredits,underReserved:false};
  throw new Error(`invalid settlement result code for ${reason}`);
}

export class RedisAiAdmissionController {
  constructor(client){if(!client||typeof client.evalsha!=="function"||typeof client.scriptLoad!=="function") throw new TypeError("client must expose evalsha() and scriptLoad()"); this.client=client; this.shas=null;}
  async loadScripts(){
    if(!this.shas){
      const [admission,settlement,reap]=await Promise.all([this.client.scriptLoad(ADMISSION_LUA),this.client.scriptLoad(SETTLEMENT_LUA),this.client.scriptLoad(REAP_LUA)]);
      this.shas={admission,settlement,reap};
    }
    return this.shas;
  }
  async evalWithReload(kind,keys,args){
    const shas=await this.loadScripts();
    try{return await this.client.evalsha(shas[kind],keys.length,...keys,...args);}
    catch(error){if(!String(error?.message??error).includes("NOSCRIPT")) throw error; this.shas=null; const fresh=await this.loadScripts(); return this.client.evalsha(fresh[kind],keys.length,...keys,...args);}
  }
  async admit(input){
    const keys=buildAdmissionKeys(input.tenantId,input.requestId,input), tenant=fingerprint(input.tenantId);
    const [tn,tp]=refillRatio(input.tpmRefillNumerator,input.tpmRefillPeriodMs,input.tpmRefillMicrocreditsPerMs,"TPM");
    const [rn,rp]=refillRatio(input.rpmRefillNumerator,input.rpmRefillPeriodMs,input.rpmRefillRequestsPerMs,"RPM");
    return decodeAdmissionResult(await this.evalWithReload("admission",Object.values(keys),[input.tpmCapacityMicrocredits,tn,tp,input.requestCostMicrocredits,input.rpmCapacity,rn,rp,input.maxConcurrent,input.reservationTtlMs,input.dailyBudgetMicrousd??0,input.monthlyBudgetMicrousd??0,input.dailyPeriod,input.monthlyPeriod,input.reservedCostMicrousd??0,requestKey(input.requestId),tenant]));
  }
  async settle(input){
    const keys=buildSettlementKeys(input.tenantId,input.requestId,input);
    const [num,period]=refillRatio(input.tpmRefillNumerator,input.tpmRefillPeriodMs,input.tpmRefillMicrocreditsPerMs,"TPM");
    return decodeSettlementResult(await this.evalWithReload("settlement",Object.values(keys),[input.tpmCapacityMicrocredits,num,period,input.actualCostMicrocredits,input.actualCostMicrousd??0,input.reservationTtlMs]));
  }
  async reap(input){
    const keys=buildSettlementKeys(input.tenantId,input.requestId,input);
    const [num,period]=refillRatio(input.tpmRefillNumerator,input.tpmRefillPeriodMs,input.tpmRefillMicrocreditsPerMs,"TPM");
    const result=await this.evalWithReload("reap",Object.values(keys),[input.tpmCapacityMicrocredits,num,period,input.minimumAgeMs,input.reservationTtlMs]);
    if(!Array.isArray(result)||result.length<3) throw new Error("invalid reap result");
    const code=Number(result[0]),reason=String(result[2]);
    if(code===1&&reason==="expired") return {status:"expired",refundMicrocredits:Number(result[1])};
    if(code===0||code===2) return {status:reason,refundMicrocredits:Number(result[1])};
    throw new Error(`reap failed closed: ${reason}`);
  }
}
export const scripts=Object.freeze({admission:ADMISSION_LUA,settlement:SETTLEMENT_LUA,reap:REAP_LUA});
