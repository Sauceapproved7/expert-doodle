import {buildCommandCenter,calculateEconomics,profitSniper,evaluateGuardrails} from "../../hercules-forge/marketing-machine/engines.mjs";
import * as machine from "../../hercules-forge/marketing-machine/modules.mjs";

const MODULES = Object.freeze([
  ["THE MACHINE","orchestrate","Turns verified signals into a bounded growth plan."],
  ["Product Intelligence Engine","intelligence","Scores product demand, margin, proof, and merchandising gaps."],
  ["Creative Lab","creative","Generates evidence-linked creative hypotheses and briefs."],
  ["Offer Architect","offer","Builds bounded offer structures from verified economics."],
  ["Ad Economics Calculator","economics","Models break-even CAC, ROAS, contribution margin, and refund drag."],
  ["Landing-Page Killer","conversion","Audits landing-page friction and prioritizes conversion fixes."],
  ["Retention Engine","retention","Finds repeat-purchase, lifecycle, and win-back opportunities."],
  ["Creative Performance Brain","learning","Turns creative performance evidence into reusable learning."],
  ["Daily Command Center","control","Ranks daily revenue actions, blockers, and evidence gaps."],
  ["BLACKBOX","synthesis","Synthesizes cross-module signals without exposing unsafe mutation paths."],
  ["Shadow Radar","radar","Detects emerging competitor, channel, and customer-pattern shifts."],
  ["Creative DNA","creative-memory","Extracts repeatable winning creative attributes."],
  ["Profit Sniper","profit","Ranks actions by verified contribution-profit opportunity."],
  ["Customer X-Ray","customer","Builds privacy-bounded customer insight from permitted evidence."],
  ["Kill Switch","safety","Stops actions when evidence, economics, policy, or authorization fails."],
  ["THE LAB","experimentation","Runs bounded experiment planning and evidence-based winner logic."]
]);

export function createMarketing16Manifest(){return {id:"hercules-marketing-16-v1",owner:"SauceApproved enterprise LLC",executionPolicy:"fail-closed",autoPublish:false,autoSpend:false,storefrontMutation:false,modules:MODULES.map(([name,kind,purpose],index)=>({id:`m${String(index+1).padStart(2,"0")}`,name,kind,purpose,evidenceRequired:true}))};}
function cleanEvidence(ids){return Array.isArray(ids)?[...new Set(ids.map(String).map(x=>x.trim()).filter(Boolean))]:[];}
function requireContext(input={}){const evidenceIds=cleanEvidence(input.evidenceIds);if(!evidenceIds.length)throw new Error("marketing_evidence_required");const brandId=String(input.brandId||"").trim();if(!brandId)throw new Error("marketing_brand_required");const objective=String(input.objective||"").trim();if(!objective)throw new Error("marketing_objective_required");return {evidenceIds,brandId,objective};}
export function planMarketing16Run(input={}){const {evidenceIds,brandId,objective}=requireContext(input);const manifest=createMarketing16Manifest();return {suiteId:manifest.id,brandId,objective,evidenceIds,releaseReady:false,actions:manifest.modules.map(module=>({moduleId:module.id,moduleName:module.name,objective,evidenceIds,evidenceRequired:true,publishAllowed:false,spendAllowed:false,storefrontMutationAllowed:false,requiresExplicitReleaseAuthorization:true}))};}

function runMachine(payload,ctx){const plan=planMarketing16Run(ctx);return {plan,priorityActions:plan.actions.slice(1).map(x=>({moduleId:x.moduleId,moduleName:x.moduleName,status:"planned"})),input:payload};}
function runLab(payload={}){const variants=Array.isArray(payload.variants)?payload.variants:[];const minSampleSize=Math.max(1,Number(payload.minSampleSize)||20);if(variants.length<2)return {status:"needs_variants",winner:null,variants};if(variants.some(v=>(Number(v.sampleSize)||0)<minSampleSize))return {status:"insufficient_sample",winner:null,minSampleSize,variants};const scored=variants.map(v=>({...v,rate:(Number(v.sampleSize)||0)>0?(Number(v.conversions)||0)/Number(v.sampleSize):0})).sort((a,b)=>b.rate-a.rate);return {status:"candidate_winner",winner:scored[0]?.id??null,requiresExplicitReleaseAuthorization:true,ranked:scored};}

const EXECUTORS={
 m01:(p,c)=>runMachine(p,c),m02:p=>machine.productIntelligence(p),m03:p=>machine.creativeLab(p),m04:p=>machine.offerArchitect(p),
 m05:p=>calculateEconomics(p),m06:p=>machine.landingPageKiller(p),m07:p=>machine.retentionEngine(p),m08:p=>machine.creativePerformanceBrain(p.rows||[]),
 m09:p=>buildCommandCenter(p),m10:p=>machine.blackbox(p.events||[]),m11:p=>machine.shadowRadar(p.pages||[]),m12:p=>machine.creativeDNA(p.items||[]),
 m13:p=>profitSniper(p),m14:p=>machine.customerXRay(p.feedback||[]),m15:p=>evaluateGuardrails(p),m16:p=>runLab(p)
};

export function executeMarketing16Module(input={}){
 const moduleId=String(input.moduleId||"").trim();
 if(!EXECUTORS[moduleId])return {ok:false,error:"unknown_marketing_module",moduleId};
 const ctx=requireContext(input);const manifest=createMarketing16Manifest();const module=manifest.modules.find(x=>x.id===moduleId);
 const data=EXECUTORS[moduleId](input.payload||{},ctx);
 return {ok:true,moduleId,moduleName:module.name,data,evidenceIds:ctx.evidenceIds,publishAllowed:false,spendAllowed:false,storefrontMutationAllowed:false,requiresExplicitReleaseAuthorization:true};
}
