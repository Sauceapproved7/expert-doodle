import { MARKETING_SYSTEMS } from "./index.mjs";
const n=v=>Number.isFinite(Number(v))?Number(v):0;
export function calculateEconomics({price=0,cogs=0,fees=0,shipping=0}={}){
 const revenue=n(price),cost=n(cogs)+n(fees)+n(shipping),contributionMargin=revenue-cost;
 return {revenue,cost,contributionMargin,marginPct:revenue?contributionMargin/revenue:0,breakEvenRoas:contributionMargin>0?revenue/contributionMargin:null};
}
export function evaluateGuardrails({spend,maxSpend,sampleSize,minSampleSize}={}){
 if(![spend,maxSpend,sampleSize,minSampleSize].every(v=>Number.isFinite(Number(v))))return {allow:false,reason:"missing_guardrail_input"};
 if(n(sampleSize)<n(minSampleSize))return {allow:false,reason:"insufficient_sample"};
 if(n(spend)>n(maxSpend))return {allow:false,reason:"spend_limit_breached"};
 return {allow:true,reason:"within_guardrails"};
}
export function buildCommandCenter({metrics={},alerts=[]}={}){
 return {generatedAt:new Date(0).toISOString(),systems:MARKETING_SYSTEMS,metrics,alerts,writeMode:"approval-gated"};
}
export function profitSniper({revenue=0,cogs=0,fees=0,shipping=0,adSpend=0}={}){
 const contribution=n(revenue)-n(cogs)-n(fees)-n(shipping)-n(adSpend);
 return {contribution,flag:contribution<0?"negative_contribution":contribution===0?"break_even":"positive_contribution"};
}
