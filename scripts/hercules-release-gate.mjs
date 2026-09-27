import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot=path.resolve(fileURLToPath(new URL("../",import.meta.url)));
const defaultPolicyPath=path.join(repoRoot,"governance","hercules-release-gate-v1.json");

export const REQUIRED_CHECKS=[
  "build.ownerCode",
  "build.provenance",
  "build.workflowSyntax",
  "build.tests",
  "security.securityBaseline",
  "security.codeql",
  "security.authHardening",
  "deployment.signedRelease",
  "deployment.verifiedDeployment",
  "deployment.criticalHealth",
  "deployment.noOpenCriticalIncidents",
  "rollback.rollbackReady",
  "smoke.storefrontSmoke",
  "smoke.checkoutSmoke",
  "smoke.finalCustomerSmoke",
  "domain.customDomainComplete",
  "commercial.pricing",
  "commercial.terms",
  "commercial.privacy",
  "release.ownerPublicReleaseApproval"
];

function getPath(value,dottedPath){
  return dottedPath.split(".").reduce((current,key)=>current?.[key],value);
}

export function evaluateReleaseGate(evidence={}){
  const blockers=REQUIRED_CHECKS.filter((check)=>getPath(evidence,check)!==true);
  const ok=blockers.length===0;
  return {
    schema:"sauceapproved.hercules.release-gate-result",
    version:1,
    ok,
    eligibleForPublicRelease:ok,
    blockers
  };
}

async function exists(relativePath){
  try{
    await stat(path.join(repoRoot,relativePath));
    return true;
  }catch{
    return false;
  }
}

export async function verifyReleaseGatePolicy(policyPath=defaultPolicyPath){
  const policy=JSON.parse(await readFile(policyPath,"utf8"));
  const errors=[];

  if(policy.schema!=="sauceapproved.hercules.release-gate"){
    errors.push("release gate policy schema mismatch");
  }
  if(policy.version!==1){
    errors.push("release gate policy version must be 1");
  }
  if(policy.canonicalRepository!=="Sauceapproved7/expert-doodle"){
    errors.push("canonical repository mismatch");
  }
  if(policy.mode!=="read-only-evaluator"||policy.mutatesProduction!==false){
    errors.push("release gate must remain read-only and non-mutating");
  }
  if(policy.publicRegistrationMutationAllowed!==false){
    errors.push("release gate must not open public registration");
  }

  const policyChecks=(policy.phases??[])
    .flatMap((phase)=>phase.checks??[])
    .map((check)=>String(check.evidencePath))
    .sort();
  const required=[...REQUIRED_CHECKS].sort();

  if(JSON.stringify(policyChecks)!==JSON.stringify(required)){
    errors.push("policy evidence paths do not exactly match the required release checks");
  }

  const releasePhase=(policy.phases??[]).find((phase)=>phase.id==="release");
  if(!releasePhase||releasePhase.ownerOnly!==true){
    errors.push("final release authorization must remain owner-only");
  }

  const commercialPhase=(policy.phases??[]).find((phase)=>phase.id==="commercial");
  if(!commercialPhase||commercialPhase.ownerOnly!==true){
    errors.push("commercial approvals must remain owner-only");
  }

  for(const artifact of policy.localArtifacts??[]){
    if(!await exists(String(artifact))){
      errors.push("missing release-gate dependency: "+artifact);
    }
  }

  return {
    schema:"sauceapproved.hercules.release-gate-policy-verification",
    version:1,
    ok:errors.length===0,
    errors,
    requiredChecks:required.length,
    localArtifacts:(policy.localArtifacts??[]).length
  };
}

async function main(){
  const args=process.argv.slice(2);
  if(args.includes("--verify-policy")){
    const result=await verifyReleaseGatePolicy();
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
    return;
  }

  const evidenceIndex=args.indexOf("--evidence");
  if(evidenceIndex>=0){
    const evidencePath=args[evidenceIndex+1];
    if(!evidencePath)throw new Error("--evidence requires a JSON file path");
    const evidence=JSON.parse(await readFile(path.resolve(evidencePath),"utf8"));
    const result=evaluateReleaseGate(evidence);
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
    return;
  }

  throw new Error("usage: node scripts/hercules-release-gate.mjs --verify-policy | --evidence <file.json>");
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch((error)=>{
    console.error(error.stack||error.message);
    process.exitCode=1;
  });
}
