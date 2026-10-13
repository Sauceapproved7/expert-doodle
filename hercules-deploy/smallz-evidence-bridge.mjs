/**
 * Bounded Smallz read-only provider-evidence bridge.
 *
 * Injected reader functions are transport adapters, not a trust anchor.
 * This module neither owns provider credentials nor independently authenticates
 * JSON returned by a reader. The caller must separately authenticate tool access.
 * No deploy, rollback, billing, environment or identity mutation is possible.
 */
import {assessSmallzReleaseEvidence} from '../hercules-runtime/smallz-release-proof.mjs';

const REPO='Sauceapproved7/expert-doodle';
const GITHUB_REF='https://api.github.com/repos/'+REPO+'/git/ref/heads/main';
const WORKSPACE='tea-dalo7he5vjqs7383n2o0';
const SERVICE_ID='srv-db08fglg1s2s73d0o2rg';
const SERVICE_URL='https://smallz-hercules.onrender.com';
const SHA=/^[a-f0-9]{40}$/u;
const MAX_JSON_BYTES=65536;
const exactObject=(x,fields)=>x!==null&&typeof x==='object'
  &&!Array.isArray(x)&&Object.keys(x).length===fields.length
  &&fields.every(key=>Object.hasOwn(x,key));
function boundedJson(raw){
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>MAX_JSON_BYTES)throw Error('invalid_provider_envelope');
  return JSON.parse(raw.split('\n\n cursor:')[0]);
}
function githubResult(raw){
  if(!raw?.result||typeof raw.result.content!=='string')throw Error('invalid_github_read');
  const parsed=boundedJson(raw.result.content);
  if(parsed?.ref!=='refs/heads/main'||typeof parsed.object?.sha!=='string'||!SHA.test(parsed.object.sha))
    throw Error('invalid_github_head');
  return parsed.object.sha;
}
function renderServiceResult(raw){
  if(typeof raw?.text!=='string')throw Error('invalid_render_service');
  return boundedJson(raw.text);
}
function renderDeploymentResult(raw){
  if(typeof raw?.text!=='string')throw Error('invalid_render_deployment');
  const deployments=boundedJson(raw.text);
  if(!Array.isArray(deployments)||deployments.length!==1)throw Error('invalid_render_deployment_count');
  return deployments[0];
}
function result({reasons=[],mainCommit=null,liveCommit=null,liveDeploymentId=null,ownerAligned=false}={}){
  const sorted=[...new Set(reasons)].sort();
  return Object.freeze({
    schema:'sauceapproved.hercules.smallz-evidence-bridge.v1',
    status:sorted.length?'HOLD':'CONSISTENT_UNATTESTED',
    reasonCodes:sorted,
    serviceId:SERVICE_ID,
    mainCommit,liveCommit,liveDeploymentId,
    ownerRuntimeRecordAligned:ownerAligned,
    evidenceLevel:'reader_records_only',
    providerRecordsIndependentlyAuthenticated:false,
    recordFreshnessIndependentlyVerified:false,
    ownerAuthorizationVerified:false,
    runtimeHealthVerified:false,
    productionChanged:false,
    networkOperationsPerformedByModule:false,
    releaseApproved:false,
    executionAuthority:false
  });
}
function strictOwnerRead(owner){
  const fields=['schema','service','renderServiceId','repository','branch','commitSha','ownerAuthenticatedIdentityOnly','externalControlReadObserved'];
  const id=owner?.identity;
  return exactObject(owner,['status','authenticatedControlReadObserved','identity'])
    &&owner.status==='observed'
    &&owner.authenticatedControlReadObserved===true
    &&exactObject(id,fields)
    &&id.schema==='sauceapproved.hercules.smallz-runtime-identity.v1'
    &&id.service==='smallz'
    &&id.renderServiceId===SERVICE_ID
    &&id.repository===REPO
    &&id.branch==='main'
    &&typeof id.commitSha==='string'
    &&SHA.test(id.commitSha)
    &&id.ownerAuthenticatedIdentityOnly===true
    &&id.externalControlReadObserved===true;
}

/**
 * Read only the exact pinned provider records. These are supplied by the
 * caller's already-connected GitHub/Render readers; this module cannot
 * authenticate the readers or turn their claims into execution authority.
 */
export async function collectSmallzEvidence({githubRead,renderServiceRead,renderDeployRead,ownerIdentityRead}={}){
  if(typeof githubRead!=='function'||typeof renderServiceRead!=='function'
    ||typeof renderDeployRead!=='function')return result({reasons:['MISSING_READERS']});
  let main,service,deployment;
  try{
    const outputs=await Promise.all([
      githubRead({url:GITHUB_REF}),
      renderServiceRead({workspaceId:WORKSPACE,serviceId:SERVICE_ID}),
      renderDeployRead({workspaceId:WORKSPACE,serviceId:SERVICE_ID,limit:1})
    ]);
    main=githubResult(outputs[0]);
    service=renderServiceResult(outputs[1]);
    deployment=renderDeploymentResult(outputs[2]);
  }catch{
    // Never echo provider payload, headers, tokens, or exception strings.
    return result({reasons:['PROVIDER_READ_FAILED']});
  }
  const mainCommit=main;
  const reasons=[];
  const serviceBound=service?.id===SERVICE_ID
    &&service?.name==='smallz-hercules'
    &&service?.repo==='https://github.com/'+REPO
    &&service?.branch==='main'
    &&service?.serviceDetails?.url===SERVICE_URL
    &&service?.serviceDetails?.runtime==='node'
    &&service?.serviceDetails?.plan==='free'
    &&service?.suspended==='not_suspended';
  if(!serviceBound)reasons.push('PROVIDER_IDENTITY_MISMATCH');
  if(service?.autoDeploy!=='no'||service?.autoDeployTrigger!=='off')
    reasons.push('AUTO_DEPLOY_ACTIVE');
  const validDeploy=deployment?.status==='live'
    &&typeof deployment.id==='string'
    &&/^dep-[A-Za-z0-9_-]{8,80}$/u.test(deployment.id)
    &&typeof deployment?.commit?.id==='string'
    &&SHA.test(deployment.commit.id);
  if(!validDeploy)reasons.push('LIVE_DEPLOYMENT_UNVERIFIED');
  const liveCommit=validDeploy?deployment.commit.id:null;
  const liveDeploymentId=validDeploy?deployment.id:null;
  if(liveCommit!==null &&mainCommit!==liveCommit)
    reasons.push('MAIN_DEPLOY_SHA_MISMATCH');
  let owner=null;
  if(typeof ownerIdentityRead==='function'){
    try{
      const candidate=await ownerIdentityRead();
      if(strictOwnerRead(candidate))owner=candidate;
    }catch{/* Owner read exceptions may contain secret-shaped content. */}
  }
  const proof=assessSmallzReleaseEvidence({
    service,
    deployment,
    githubMainSha:main,
    ownerRead:owner
  });
  if(!owner||!proof.ownerRuntimeIdentityAligned)reasons.push('OWNER_RUNTIME_UNVERIFIED');
  if(!proof.providerRecordConsistent)reasons.push('PROVIDER_RECORD_INCONSISTENT');
  return result({
    reasons,
    mainCommit,
    liveCommit,
    liveDeploymentId,
    ownerAligned:Boolean(owner&&proof.ownerRuntimeIdentityAligned)
  });
}
