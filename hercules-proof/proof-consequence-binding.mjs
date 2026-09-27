import {createHash} from "node:crypto";
import {verifyProofObject} from "./proof-object.mjs";
import {verifyConsequenceEnvelope} from "../hercules-consequence/consequence-envelope.mjs";
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function digest(v){return createHash("sha256").update(JSON.stringify(stable(v))).digest("hex")}
const SHA=/^[a-f0-9]{64}$/i;
export function bindProofToConsequence({proof,consequence}={}){
 const pv=verifyProofObject(proof),cv=verifyConsequenceEnvelope(consequence);
 if(!pv.valid)throw new Error("proof verification failed");
 if(!cv.valid)throw new Error("consequence verification failed");
 if(proof.authorization?.evidenceSha256?.toLowerCase()!==consequence.authority?.evidenceSha256?.toLowerCase())throw new Error("authorization evidence mismatch");
 const body={schema:"hercules.proof.consequence.binding.v1",proofSha256:proof.proofSha256,consequenceSha256:consequence.envelopeSha256,authorizationEvidenceSha256:proof.authorization.evidenceSha256.toLowerCase(),disposition:consequence.disposition,executionAuthority:false};
 return Object.freeze({...body,bindingSha256:digest(body)});
}
export function verifyProofConsequenceBinding(binding={}){
 const {bindingSha256,...body}=binding;
 if(!SHA.test(bindingSha256??""))return Object.freeze({valid:false,reason:"INVALID_DIGEST"});
 const calculatedSha256=digest(body),valid=calculatedSha256===bindingSha256;
 return Object.freeze({valid,reason:valid?"VERIFIED":"DIGEST_MISMATCH",calculatedSha256});
}
