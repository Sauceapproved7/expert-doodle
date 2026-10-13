/**
 * Hercules Smallz exact-SHA release planner, v1 — no IO, credentials or authority.
 * The plan can only be submitted by a separately authorized provider transport.
 * This code cannot disable Render autodeploy, make API calls or certify production.
 */
const SERVICE_ID='srv-db08fglg1s2s73d0o2rg';
const LIVE_SHA='ac4ebb822e421e4cc3a3b6bbea28330552304d95';
const CANDIDATE_SHA='861c8244ef1f86ec8843569e372d6f01abb8aec1';
const LIVE_DEPLOY_ID='dep-db6psunf3r2c73c27ph0';
const REPO='https://github.com/Sauceapproved7/expert-doodle';
const SHA=/^[a-f0-9]{40}$/u;
export const SMALLZ_RELEASE=Object.freeze({
  serviceId:SERVICE_ID,rollbackSha:LIVE_SHA,candidateSha:CANDIDATE_SHA,liveDeploymentId:LIVE_DEPLOY_ID,
});

function base(status,reason){return Object.freeze({
  schema:'sauceapproved.hercules.smallz-exact-commit-plan.v1',
  status,reason,request:null,expectedPriorDeploymentId:null,
  productionChanged:false,ownerAuthorizationVerified:false,
  liveRuntimeVerified:false,rollbackAuthorized:false,releaseApproved:false,
  executionAuthority:false,
});}

export function planSmallzExactCommitRelease(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return base('held','missing_provider_evidence');
  const {service,liveDeployment,releaseCommit}=input;
  if(!service||typeof service!=='object'||!liveDeployment||typeof liveDeployment!=='object')
    return base('held','missing_provider_evidence');
  if(service.id!==SERVICE_ID||service.name!=='smallz-hercules'
     ||service.repo!==REPO||service.branch!=='main'
     ||service.suspended!=='not_suspended'
     ||service.serviceDetails?.url!=='https://smallz-hercules.onrender.com'
     ||service.serviceDetails?.runtime!=='node'
     ||service.serviceDetails?.plan!=='free')return base('held','service_identity_mismatch');
  if(service.autoDeploy!=='no'||service.autoDeployTrigger!=='off')
    return base('held','auto_deploy_must_be_disabled_by_owner');
  if(liveDeployment.id!==LIVE_DEPLOY_ID||liveDeployment.status!=='live'
     ||liveDeployment.commit?.id!==LIVE_SHA||!SHA.test(liveDeployment.commit.id))
    return base('held','live_deployment_drift');
  if(releaseCommit!==CANDIDATE_SHA||!SHA.test(releaseCommit))
    return base('held','unreviewed_or_invalid_release_sha');
  return Object.freeze({
    ...base('prepared_not_submitted','exact_commit_transport_only'),
    request:Object.freeze({
      method:'POST',
      url:'https://api.render.com/v1/services/'+SERVICE_ID+'/deploys',
      body:Object.freeze({commitId:CANDIDATE_SHA,clearCache:'do_not_clear',deployMode:'build_and_deploy'}),
    }),
    expectedPriorDeploymentId:LIVE_DEPLOY_ID,
  });
}
