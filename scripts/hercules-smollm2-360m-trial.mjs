// Hercules-owned read-only quality/footprint evidence for a third-party model.
// The source/model are external Apache-2.0 assets fetched ephemerally by CI.
import {evaluateRealModelTrial,readTrialEvidence} from "./hercules-real-model-trial.mjs";

export const HERCULES_360M_MODEL=Object.freeze({
  source:"bartowski/SmolLM2-360M-Instruct-GGUF",
  revision:"7be6f65f1db715fe5dc5a4634c0d459b4eed42ec",
  name:"SmolLM2-360M-Instruct.Q4_K_M.gguf",
  sha256:"2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2",
  bytes:270590880,
  license:"apache-2.0",
});
export function assess360mTrial(evidence,options={}){
  const original=evaluateRealModelTrial(evidence,options);
  return Object.freeze({
    ...original,
    candidate:HERCULES_360M_MODEL.name,
    modelRevision:HERCULES_360M_MODEL.revision,
    checkScope:"three fixed questions, not conversational quality",
    chatInferenceVerifiedForProduction:false,
    publicReleaseApproved:false,
    paidCommerceEnabled:false,
  });
}
if(process.argv[1] &&
   import.meta.url.endsWith("/"+process.argv[1].split("/").at(-1)) &&
   process.argv.includes("--evaluate")){
  const idx=process.argv.indexOf("--evaluate");
  if(idx+1>=process.argv.length)throw new Error("local trial evidence directory required");
  try{
    const outcome=assess360mTrial(readTrialEvidence(process.argv[idx+1]));
    process.stdout.write(JSON.stringify(outcome)+"\n");
  }catch{
    process.stdout.write(JSON.stringify({
      candidate:HERCULES_360M_MODEL.name,
      experimentalEligible:false,
      publicReleaseApproved:false,
      error:"real_model_trial_evidence_unavailable"
    })+"\n");
    process.exitCode=1;
  }
}
