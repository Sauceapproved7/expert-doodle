import {spawnSync} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const compose=["compose","--project-name","hercules-staging","--env-file",root+"staging-plane/.env","-f",root+"staging-plane/compose.yml"];
const target="http://127.0.0.1:38080/api/health";
function docker(...args){
  const result=spawnSync("docker",[...compose,...args],{stdio:"inherit",timeout:60000});
  if(result.error||result.status!==0)throw new Error("staging_docker_action_failed:"+args.join("_"));
}
async function probe(){
  const response=await fetch(target,{signal:AbortSignal.timeout(4000)});
  const body=await response.json();
  if(body.environment!=="staging"||body.fixture!==true||body.customerData!==false)
    throw new Error("staging_identity_required");
  return {status:response.status,healthy:body.ok===true&&body.database===true};
}
async function waitFor(healthy){
  const deadline=performance.now()+60000;
  while(performance.now()<deadline){
    const result=await probe();
    if(healthy?result.status===200&&result.healthy:result.status===503&&!result.healthy)return;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw new Error(healthy?"recovery_deadline_exceeded":"outage_not_detected");
}
export async function drill(){
  if(process.argv[2]!=="--confirm-isolated-staging")throw new Error("explicit_staging_confirmation_required");
  await waitFor(true);
  const evidence={schemaVersion:1,scope:"single-runner staging dependency outage; not regional failover",target,startedAt:new Date().toISOString(),passed:false};
  let interrupted=false;
  let failure;
  try{
    interrupted=true;
    const outageStart=performance.now();
    docker("stop","postgrest");
    await waitFor(false);
    evidence.outageDetectionMs=performance.now()-outageStart;
    const recoveryStart=performance.now();
    docker("start","postgrest");
    await waitFor(true);
    evidence.serviceRecoveryMs=performance.now()-recoveryStart;
    const verify=spawnSync(process.execPath,[root+"scripts/staging-plane.mjs","verify"],{cwd:root,stdio:"inherit",timeout:60000});
    if(verify.error||verify.status!==0)throw new Error("post_recovery_data_verification_failed");
    evidence.syntheticDataVerified=true;
    evidence.passed=true;
  }catch(error){failure=error;evidence.error=error.message;}
  finally{
    if(interrupted){
      try{docker("start","postgrest");await waitFor(true);evidence.cleanupRecovered=true;}
      catch(error){evidence.cleanupRecovered=false;evidence.passed=false;failure??=error;}
    }
    evidence.completedAt=new Date().toISOString();
    await mkdir(root+"benchmarks/performance",{recursive:true});
    await writeFile(root+"benchmarks/performance/staging-recovery-drill.json",JSON.stringify(evidence,null,2)+"\n");
    console.log(JSON.stringify(evidence,null,2));
  }
  if(failure)throw failure;
}
if(process.argv[1]===fileURLToPath(import.meta.url))drill().catch(error=>{console.error(error.message);process.exitCode=1;});
