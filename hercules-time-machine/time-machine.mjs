import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{64}$/i, TYPES=new Set(["ROLLBACK","COMPENSATE","MANUAL_ONLY"]);
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
export function createRestorePoint(input={}){
 if(!input.action?.type||!input.action?.target)throw new Error("action required");
 if(!SHA.test(input.authorization?.evidenceSha256??""))throw new Error("authorization evidence required");
 if(!SHA.test(input.before?.sha256??"")||!SHA.test(input.after?.sha256??""))throw new Error("before and after evidence required");
 if(!TYPES.has(input.recovery?.type)||!input.recovery?.target)throw new Error("recovery classification required");
 const body=stable({schema:"hercules.time-machine.restore-point.v1",action:input.action,authorization:{evidenceSha256:input.authorization.evidenceSha256.toLowerCase()},before:input.before,after:input.after,recovery:{type:input.recovery.type,target:input.recovery.target,verified:input.recovery.verified===true},dependencies:[...(input.dependencies??[])].map(String).sort(),executionAuthority:false});
 return {...body,restorePointSha256:digest(body)};
}
export function verifyRestorePoint(point={}){
 const {restorePointSha256,...body}=point;
 if(!SHA.test(restorePointSha256??""))return {valid:false,reason:"INVALID_DIGEST"};
 const calculatedSha256=digest(body),valid=calculatedSha256===restorePointSha256;
 return {valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256};
}
export function planRecovery(point={}){
 const verified=verifyRestorePoint(point);
 if(!verified.valid)return {schema:"hercules.time-machine.recovery-plan.v1",mode:"MANUAL_ONLY",reasonCodes:["INVALID_RESTORE_POINT"],requiresApproval:true,executionAuthority:false};
 const reasons=[];
 let mode=point.recovery.type;
 if(!point.recovery.verified){mode="MANUAL_ONLY";reasons.push("UNVERIFIED_RECOVERY")}
 if(point.recovery.type==="COMPENSATE")reasons.push("IRREVERSIBLE_EXTERNAL_EFFECT");
 if(point.recovery.type==="MANUAL_ONLY")reasons.push("MANUAL_RECOVERY_REQUIRED");
 return Object.freeze({schema:"hercules.time-machine.recovery-plan.v1",restorePointSha256:point.restorePointSha256,mode,reasonCodes:reasons.sort(),target:point.recovery.target,requiresApproval:true,executionAuthority:false});
}
