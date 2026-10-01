import {createHash} from "node:crypto";
const req=(v,label)=>{if(typeof v!=="string"||!v.trim())throw new Error(label+" required");return v.trim()};
const sha=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function createCleanerReleaseProof({release,installation}={}){
 if(!release||release.schema!=="sauceapproved.hercules.cleaner.package.v1"||release.product!=="Hercules Cleaner")throw new Error("canonical Cleaner release required");
 const commit=req(release.sourceCommit,"release source commit");
 if(!/^[a-f0-9]{40}$/.test(commit)||!/^([a-f0-9]{64})$/.test(req(release.aggregateSha256,"release aggregate SHA-256")))throw new Error("immutable release identity required");
 if(!installation||installation.sourceCommit!==commit)throw new Error("source commit mismatch");
 if(installation.aggregateSha256!==release.aggregateSha256)throw new Error("aggregate package mismatch");
 if(installation.recoveryCapsulePreserved!==true)throw new Error("Recovery Capsule preservation required");
 if(installation.rollbackIdentity!==commit)throw new Error("rollback identity mismatch");
 return Object.freeze({
  artifact:"sha256:"+release.aggregateSha256,
  config:"sha256:"+sha({recoveryCapsulePreserved:true,rollbackIdentity:commit}),
  identity:"cleaner:"+release.version+":"+commit,
  policy:"guardian-cleaner-release-v1",
  executionAuthority:false
 });
}
