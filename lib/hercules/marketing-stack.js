export const MARKETING_MODULES=Object.freeze([
["the-machine","THE MACHINE","orchestrate"],["product-intelligence","Product Intelligence Engine","research"],
["creative-lab","Creative Lab","creative"],["offer-architect","Offer Architect","offer"],
["ad-economics","Ad Economics Calculator","economics"],["landing-page-killer","Landing-Page Killer","conversion"],
["retention-engine","Retention Engine","retention"],["creative-performance-brain","Creative Performance Brain","measurement"],
["daily-command-center","Daily Command Center","operations"],["blackbox","BLACKBOX","diagnostics"],
["shadow-radar","Shadow Radar","signals"],["creative-dna","Creative DNA","patterns"],
["profit-sniper","Profit Sniper","profit"],["customer-x-ray","Customer X-Ray","customer"],
["kill-switch","Kill Switch","safety"],["the-lab","THE LAB","experiments"]
].map(([id,name,role],index)=>Object.freeze({id,name,role,order:index+1})));
export function getMarketingModule(id){return MARKETING_MODULES.find(x=>x.id===id)||null}
export function buildMarketingRun({goal=""}={}){
 const clean=String(goal).trim();
 if(!clean)throw new Error("goal_required");
 return Object.freeze({state:"prepared",executionAuthorized:false,goal:clean,
 steps:MARKETING_MODULES.map(x=>Object.freeze({order:x.order,moduleId:x.id,moduleName:x.name,role:x.role,state:"queued"}))});
}

export function moduleContract(id){
 const m=getMarketingModule(id); if(!m)throw new Error("unknown_module");
 return Object.freeze({id:m.id,name:m.name,role:m.role,input:"context",output:"evidence",mutates:false});
}
export function authorizeMarketingRun(plan,{approved=false,killSwitch=false}={}){
 if(!plan||plan.state!=="prepared")throw new Error("invalid_plan");
 if(killSwitch)return Object.freeze({...plan,state:"blocked",executionAuthorized:false,blockedBy:"kill-switch"});
 return Object.freeze({...plan,state:approved?"authorized":"prepared",executionAuthorized:approved===true});
}

export function createMarketingEvidence(plan,moduleId,{summary="",artifacts=[]}={}){
 if(!plan||!Array.isArray(plan.steps))throw new Error("invalid_plan");
 const m=getMarketingModule(moduleId); if(!m)throw new Error("unknown_module");
 const clean=String(summary).trim(); if(!clean)throw new Error("summary_required");
 return Object.freeze({moduleId:m.id,moduleName:m.name,order:m.order,summary:clean,
  artifacts:Object.freeze([...artifacts].map(String)),status:"complete"});
}
export function evaluateMarketingPromotion(plan,evidence=[]){
 if(!plan?.executionAuthorized)return Object.freeze({promotable:false,reason:"not_authorized"});
 const completed=new Set(evidence.filter(x=>x?.status==="complete").map(x=>x.moduleId));
 const missing=MARKETING_MODULES.filter(x=>!completed.has(x.id)).map(x=>x.id);
 if(missing.length)return Object.freeze({promotable:false,reason:"incomplete_evidence",missing:Object.freeze(missing)});
 return Object.freeze({promotable:true,reason:"ready",modules:MARKETING_MODULES.length});
}

export const HERCULES_REQUIRED_CHECKS=Object.freeze([
 "owner-code-gate","implementation-enforcement","universal-merge-gates",
 "main-integrity-guard","github-main-protection","workflow-syntax-gate","provenance-gate"
]);
export function createMarketingReleaseCandidate(plan,evidence=[],checks={}){
 const promotion=evaluateMarketingPromotion(plan,evidence);
 if(!promotion.promotable)return Object.freeze({ready:false,reason:promotion.reason,missing:promotion.missing||[]});
 const missingChecks=HERCULES_REQUIRED_CHECKS.filter(id=>checks[id]!=="success");
 if(missingChecks.length)return Object.freeze({ready:false,reason:"required_checks_incomplete",missingChecks:Object.freeze(missingChecks)});
 return Object.freeze({ready:true,reason:"release_candidate",moduleCount:16,requiredChecks:7,deploy:false});
}
