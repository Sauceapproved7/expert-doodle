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
