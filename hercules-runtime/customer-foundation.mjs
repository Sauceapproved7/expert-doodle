import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{64}$/i;
const ROLE={viewer:0,builder:1,admin:2,owner:3};
const ACTION_ROLE={read:"viewer",build:"builder",publish:"admin","billing.manage":"owner"};
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
export function createCustomerContext(input={}){
 if(!input.user?.id||!input.workspace?.id)throw new Error("user and workspace required");
 if(!(input.membership?.role in ROLE))throw new Error("valid membership role required");
 if(!SHA.test(input.membership?.evidenceSha256??"")||!SHA.test(input.identity?.evidenceSha256??""))throw new Error("identity and membership evidence required");
 const features=[...(input.plan?.features??[])].map(String).filter(Boolean).sort();
 const monthlyActionLimit=input.plan?.monthlyActionLimit;
 const monthlyActions=input.usage?.monthlyActions;
 if(!input.plan?.id||!Number.isSafeInteger(monthlyActionLimit)||monthlyActionLimit<0)throw new Error("valid plan required");
 if(!Number.isSafeInteger(monthlyActions)||monthlyActions<0)throw new Error("valid usage required");
 const body=stable({
  schema:"hercules.customer.context.v1",
  user:{id:String(input.user.id)},
  workspace:{id:String(input.workspace.id)},
  membership:{role:input.membership.role,evidenceSha256:input.membership.evidenceSha256.toLowerCase()},
  identity:{evidenceSha256:input.identity.evidenceSha256.toLowerCase()},
  plan:{id:String(input.plan.id),features,monthlyActionLimit},
  usage:{monthlyActions},
  executionAuthority:false
 });
 return {...body,contextSha256:digest(body)};
}
export function verifyCustomerContext(context={}){
 const {contextSha256,...body}=context;
 if(!SHA.test(contextSha256??""))return {valid:false,reason:"INVALID_DIGEST"};
 const calculatedSha256=digest(body),valid=calculatedSha256===contextSha256;
 return {valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256};
}
export function evaluateCustomerAction(context={},request={}){
 const reasons=[];
 if(!verifyCustomerContext(context).valid)reasons.push("INVALID_CUSTOMER_CONTEXT");
 if(request.workspaceId!==context.workspace?.id)reasons.push("WORKSPACE_MISMATCH");
 if(!context.plan?.features?.includes(request.feature))reasons.push("FEATURE_NOT_ENTITLED");
 const required=ACTION_ROLE[request.action];
 if(!required)reasons.push("UNKNOWN_ACTION");
 else if(ROLE[context.membership?.role] < ROLE[required])reasons.push("ROLE_INSUFFICIENT");
 if(Number.isSafeInteger(context.plan?.monthlyActionLimit)&&Number.isSafeInteger(context.usage?.monthlyActions)&&context.usage.monthlyActions>=context.plan.monthlyActionLimit)reasons.push("USAGE_LIMIT_REACHED");
 return Object.freeze({schema:"hercules.customer.action-evaluation.v1",disposition:reasons.length?"DENY":"CUSTOMER_BOUNDARY_SATISFIED",reasonCodes:[...new Set(reasons)].sort(),executionAuthority:false});
}
