import {createHash} from "node:crypto";
const LEVEL={NONE:0,RECORD:1,RESOURCE:2,SYSTEM:3,ORGANIZATION:4,EXTERNAL:5};
const RECOVERY=new Set(["ROLLBACK","COMPENSATE","MANUAL_ONLY"]);
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function hash(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
function sha(v){return typeof v==="string"&&/^[a-f0-9]{64}$/i.test(v)}
export function createConsequenceEnvelope(input){
 if(!input?.action?.type||!input?.action?.target)throw new Error("action type and target required");
 const max=input?.authority?.maxImpact;
 if(!(max in LEVEL)||!sha(input?.authority?.evidenceSha256))throw new Error("valid authority ceiling and evidence required");
 if(!Array.isArray(input.effects)||!input.effects.length)throw new Error("effects required");
 const effects=input.effects.map(e=>{
  if(!e?.resource||!(e.impact in LEVEL)||!RECOVERY.has(e.reversibility))throw new Error("invalid effect");
  if(LEVEL[e.impact]>LEVEL[max])throw new Error("effect exceeds authority ceiling");
  return {resource:e.resource,impact:e.impact,reversibility:e.reversibility,verified:e.verified===true};
 }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const reasons=[];
 if(effects.some(e=>!e.verified))reasons.push("UNVERIFIED_EFFECT");
 if(effects.some(e=>e.reversibility==="COMPENSATE"))reasons.push("COMPENSATION_REQUIRED");
 if(effects.some(e=>e.reversibility==="MANUAL_ONLY"))reasons.push("MANUAL_RECOVERY_REQUIRED");
 const uncertainty=[...(input.uncertainty??[])].map(String).sort();
 if(uncertainty.length)reasons.push("DECLARED_UNCERTAINTY");
 const body={schema:"hercules.consequence.envelope.v1",action:stable(input.action),authority:{maxImpact:max,evidenceSha256:input.authority.evidenceSha256.toLowerCase()},effects,uncertainty,disposition:reasons.length?"HUMAN_REVIEW":"WITHIN_DECLARED_ENVELOPE",reasonCodes:[...new Set(reasons)].sort(),executionAuthority:false,constraints:{grantsAuthority:false,executesAction:false,predictsOutcome:false}};
 return {...body,envelopeSha256:hash(body)};
}
export function verifyConsequenceEnvelope(envelope){
 if(!sha(envelope?.envelopeSha256))return {valid:false,reason:"INVALID_DIGEST"};
 const {envelopeSha256,...body}=envelope,calculatedSha256=hash(body),valid=calculatedSha256===envelopeSha256;
 return {valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256};
}
