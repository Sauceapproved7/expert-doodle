import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{64}$/i;
const IMPACT={NONE:0,RECORD:1,RESOURCE:2,SYSTEM:3,ORGANIZATION:4,EXTERNAL:5};
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
function instant(v,name){const ms=Date.parse(v);if(!Number.isFinite(ms))throw new Error(name+" must be a valid timestamp");return new Date(ms).toISOString()}
export function createAuthorityLease(input={}){
 if(!input.subject?.type||!input.subject?.id)throw new Error("subject required");
 if(!input.intent?.id)throw new Error("intent required");
 if(!SHA.test(input.authorization?.evidenceSha256??""))throw new Error("authorization evidence required");
 const max=input.scope?.maxImpact;
 if(!(max in IMPACT))throw new Error("valid maxImpact required");
 const resources=[...(input.scope?.resources??[])].map(String).filter(Boolean).sort();
 const actions=[...(input.scope?.actions??[])].map(String).filter(Boolean).sort();
 if(!resources.length||!actions.length)throw new Error("scope resources and actions required");
 const validFrom=instant(input.validFrom,"validFrom"),expiresAt=instant(input.expiresAt,"expiresAt");
 if(Date.parse(expiresAt)<=Date.parse(validFrom))throw new Error("expiresAt must be after validFrom");
 const body=stable({
  schema:"hercules.authority.lease.v1",
  subject:input.subject,
  intent:input.intent,
  authorization:{evidenceSha256:input.authorization.evidenceSha256.toLowerCase()},
  scope:{resources,actions,maxImpact:max},
  validFrom,expiresAt,
  constraints:{carriesCredentials:false,grantsProviderPermission:false,delegatesAuthority:false},
  executionAuthority:false
 });
 return {...body,leaseSha256:digest(body)};
}
export function verifyAuthorityLease(lease={}){
 const {leaseSha256,...body}=lease;
 if(!SHA.test(leaseSha256??""))return {valid:false,reason:"INVALID_DIGEST"};
 const calculatedSha256=digest(body),valid=calculatedSha256===leaseSha256;
 return {valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256};
}
export function evaluateAuthorityLease(lease={},request={}){
 const reasons=[];
 if(!verifyAuthorityLease(lease).valid)reasons.push("INVALID_LEASE");
 const at=Date.parse(request.at);
 if(!Number.isFinite(at))reasons.push("INVALID_EVALUATION_TIME");
 else {
  if(at<Date.parse(lease.validFrom))reasons.push("LEASE_NOT_YET_VALID");
  if(at>=Date.parse(lease.expiresAt))reasons.push("LEASE_EXPIRED");
 }
 if(!lease.scope?.resources?.includes(request.resource))reasons.push("RESOURCE_OUT_OF_SCOPE");
 if(!lease.scope?.actions?.includes(request.action))reasons.push("ACTION_OUT_OF_SCOPE");
 if(!(request.impact in IMPACT))reasons.push("INVALID_IMPACT");
 else if(IMPACT[request.impact]>IMPACT[lease.scope?.maxImpact])reasons.push("IMPACT_EXCEEDS_LEASE");
 return Object.freeze({schema:"hercules.authority.lease.evaluation.v1",disposition:reasons.length?"DENY":"WITHIN_DECLARED_LEASE",reasonCodes:[...new Set(reasons)].sort(),executionAuthority:false});
}
