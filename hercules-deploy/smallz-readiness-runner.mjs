/**
 * Hercules Smallz unified server-side read-only readiness CLI.
 * The single source of credential custody and stable snapshots is
 * runSmallzReleaseReadAudit. Both explicit opt-ins are required.
 *
 * NO HTTP route, scheduler, token reads, write-methods, deploys or approvals.
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {runSmallzReleaseReadAudit} from './smallz-read-audit.mjs';

const SERVICE_ID='srv-db08fglg1s2s73d0o2rg';
const SHA=/^[a-f0-9]{40}$/u;
const DEPLOY_ID=/^dep-[A-Za-z0-9_-]{8,80}$/u;
const safeSha=v=>typeof v==='string'&&SHA.test(v)?v:null;
const safeDeploy=v=>typeof v==='string'&&DEPLOY_ID.test(v)?v:null;
function hold(reason){
  return Object.freeze({
    schema:'sauceapproved.hercules.smallz-readiness-runner.v1',
    status:'HOLD',reasonCodes:[reason],
    serviceId:SERVICE_ID,mainCommit:null,liveCommit:null,liveDeploymentId:null,
    readsAttempted:false,snapshotStability:'unverified',
    ownerRuntimeRecordAligned:false,
    providerRecordsIndependentlyAuthenticated:false,
    ownerAuthorizationVerified:false,runtimeHealthVerified:false,
    productionChanged:false,releaseApproved:false,executionAuthority:false
  });
}
function reasonCodes(record){
  if(!Array.isArray(record?.reasonCodes))return ['PROVIDER_READ_FAILED'];
  const replacements={
    DEDICATED_READ_CREDENTIALS_REQUIRED:'READ_CREDENTIALS_UNAVAILABLE',
    CREDENTIAL_BOUNDARY_VIOLATION:'CREDENTIAL_ROLE_COLLISION'
  };
  const reasons=record.reasonCodes.filter(x=>typeof x==='string'
    &&/^[A-Z][A-Z0-9_]{0,127}$/u.test(x))
    .map(x=>replacements[x]??x);
  return [...new Set(reasons)].sort();
}

/**
 * Programmatic usage still requires BOTH literal opt-ins. Credential checks,
 * snapshot stability and trust policy remain centralized in the audit.
 * No caller-provided owner read, action, URL or method can be passed through.
 */
export async function runSmallzReadiness({env={},fetchImpl=globalThis.fetch}={}){
  const e=env&&typeof env==='object'&&!Array.isArray(env)?env:{};
  if(e.HERCULES_SMALLZ_EVIDENCE_READ_ENABLED!=='true')
    return hold('READ_ONLY_MODE_DISABLED');
  if(e.HERCULES_SMALLZ_READ_AUDIT_ENABLED!=='true')
    return hold('AUDIT_SECOND_OPT_IN_REQUIRED');
  if(typeof fetchImpl!=='function')return hold('PROVIDER_READ_FAILED');
  try{
    const audit=await runSmallzReleaseReadAudit({env:e,fetchImpl});
    const reasons=reasonCodes(audit);
    const stability=audit?.snapshotStability;
    const snapshotStability=['stable','changed','unverified'].includes(stability)
      ?stability:'unverified';
    const status=audit?.status==='CONSISTENT_UNATTESTED'
      &&reasons.length===0&&snapshotStability==='stable'
      ?'CONSISTENT_UNATTESTED':'HOLD';
    return Object.freeze({
      schema:'sauceapproved.hercules.smallz-readiness-runner.v1',
      status,reasonCodes:status==='HOLD'&&reasons.length===0
        ?['PROVIDER_READ_FAILED']:reasons,
      serviceId:SERVICE_ID,
      mainCommit:status==='HOLD'&&snapshotStability==='changed'
        ?null:safeSha(audit?.mainCommit),
      liveCommit:status==='HOLD'&&snapshotStability==='changed'
        ?null:safeSha(audit?.liveCommit),
      liveDeploymentId:status==='HOLD'&&snapshotStability==='changed'
        ?null:safeDeploy(audit?.liveDeploymentId),
      readsAttempted:audit?.networkOperationsPerformedByModule===true,
      snapshotStability,
      ownerRuntimeRecordAligned:false,
      providerRecordsIndependentlyAuthenticated:false,
      ownerAuthorizationVerified:false,runtimeHealthVerified:false,
      productionChanged:false,releaseApproved:false,executionAuthority:false
    });
  }catch{
    return hold('PROVIDER_READ_FAILED');
  }
}
/** Direct execution never passes through to any deployment control. */
async function main(){
  const args=process.argv.slice(2);
  const result=args.length===1&&args[0]==='--read-only'
    ?await runSmallzReadiness({env:process.env})
    :hold('READ_ONLY_SWITCH_REQUIRED');
  process.stdout.write(JSON.stringify(result)+'\n');
  process.exitCode=result.status==='CONSISTENT_UNATTESTED'?0:2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  await main().catch(()=>{
    process.stdout.write(JSON.stringify(hold('PROVIDER_READ_FAILED'))+'\n');
    process.exitCode=2;
  });
}
