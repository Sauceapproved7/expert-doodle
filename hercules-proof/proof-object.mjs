import {createHash} from "node:crypto";
const SHA=/^[a-f0-9]{64}$/i;
function stable(v){
 if(Array.isArray(v))return v.map(stable);
 if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
 return v;
}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");}
function required(name,v){if(!v||typeof v!=="object")throw new TypeError(name+" is required");}
export function createProofObject(input={}){
 for(const k of ["intent","authorization","execution","verification","artifact","ownership","rollback"])required(k,input[k]);
 if(!SHA.test(input.authorization.evidenceSha256??""))throw new Error("invalid authorization evidence binding");
 if(input.artifact.sha256&&!SHA.test(input.artifact.sha256))throw new Error("invalid artifact evidence binding");
 const payload=stable({
  schema:"hercules.proof.object.v1",
  intent:input.intent,authorization:input.authorization,execution:input.execution,
  verification:input.verification,artifact:input.artifact,ownership:input.ownership,rollback:input.rollback,
  executionAuthority:false
 });
 return Object.freeze({...payload,proofSha256:digest(payload)});
}
export function verifyProofObject(proof={}){
 const {proofSha256,...payload}=proof;
 if(!SHA.test(proofSha256??""))return Object.freeze({valid:false,reason:"INVALID_DIGEST"});
 const calculated=digest(payload);
 return Object.freeze({valid:calculated===proofSha256,reason:calculated===proofSha256?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256:calculated});
}
