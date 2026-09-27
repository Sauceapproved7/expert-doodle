import {createHash} from "node:crypto";
import {verifyProofObject} from "../hercules-proof/proof-object.mjs";
import {verifyConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";
import {verifyProofConsequenceBinding} from "../hercules-proof/proof-consequence-binding.mjs";
import {verifyRestorePoint} from "../hercules-time-machine/time-machine.mjs";

const SHA=/^[a-f0-9]{64}$/i;
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}

export function createExecutionLifecycle(input={}){
 const auth=input.authorization?.evidenceSha256;
 if(!SHA.test(auth??""))throw new Error("valid authorization evidence required");
 const expected=auth.toLowerCase();
 const bindings=[
  input.proof?.authorization?.evidenceSha256,
  input.consequence?.authority?.evidenceSha256,
  input.binding?.authorizationEvidenceSha256,
  input.restore?.authorization?.evidenceSha256
 ].map(v=>String(v??"").toLowerCase());
 if(bindings.some(v=>v!==expected))throw new Error("authorization evidence mismatch");

 const reasons=[];
 if(!verifyProofObject(input.proof).valid)reasons.push("INVALID_PROOF");
 if(!verifyConsequenceEnvelope(input.consequence).valid)reasons.push("INVALID_CONSEQUENCE");
 if(!verifyProofConsequenceBinding(input.binding).valid)reasons.push("INVALID_BINDING");
 if(!verifyRestorePoint(input.restore).valid)reasons.push("INVALID_RESTORE_POINT");
 if(input.consequence?.disposition!=="WITHIN_DECLARED_ENVELOPE")reasons.push("CONSEQUENCE_REQUIRES_REVIEW");

 const state=reasons.length?"HUMAN_REVIEW":"READY_FOR_AUTHORIZED_EXECUTION";
 const body=stable({
  schema:"hercules.execution.lifecycle.v1",
  intent:input.intent,
  authorization:{evidenceSha256:expected},
  evidence:{
   proofSha256:input.proof?.proofSha256??null,
   consequenceSha256:input.consequence?.envelopeSha256??null,
   bindingSha256:input.binding?.bindingSha256??null,
   restorePointSha256:input.restore?.restorePointSha256??null
  },
  state,
  reasonCodes:[...new Set(reasons)].sort(),
  requiresApproval:true,
  executionAuthority:false
 });
 return Object.freeze({...body,lifecycleSha256:digest(body)});
}

export function verifyExecutionLifecycle(lifecycle={}){
 const {lifecycleSha256,...body}=lifecycle;
 if(!SHA.test(lifecycleSha256??""))return Object.freeze({valid:false,reason:"INVALID_DIGEST"});
 const calculatedSha256=digest(body),valid=calculatedSha256===lifecycleSha256;
 return Object.freeze({valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256});
}
