/**
 * Hercules Smallz Release Proof v1.
 * Compare provider records and an owner-authenticated runtime read without release authority.
 * Caller-provided Render and GitHub objects are never independently authenticated here.
 */
const SHA=/^[0-9a-f]{40}$/u;
const RENDER_ID='srv-db08fglg1s2s73d0o2rg';
const REPO_SLUG='Sauceapproved7/expert-doodle';
const SERVICE_URL='https://smallz-hercules.onrender.com';
const IDENTITY_URL=SERVICE_URL+'/api/runtime/identity';
const MAX_IDENTITY_BYTES=4096;
export function smallzRuntimeIdentity(env={}){
  if(!env||typeof env!=='object'||env.RENDER!=='true'
    ||env.RENDER_SERVICE_ID!==RENDER_ID
    ||env.RENDER_GIT_BRANCH!=='main'
    ||env.RENDER_GIT_REPO_SLUG!==REPO_SLUG
    ||env.IS_PULL_REQUEST!=='false'
    ||typeof env.RENDER_GIT_COMMIT!=='string'
    ||!SHA.test(env.RENDER_GIT_COMMIT))return null;
  return Object.freeze({
    schema:'sauceapproved.hercules.smallz-runtime-identity.v1',
    service:'smallz',renderServiceId:RENDER_ID,
    repository:REPO_SLUG,branch:'main',commitSha:env.RENDER_GIT_COMMIT,
    ownerAuthenticatedIdentityOnly:true,externalControlReadObserved:true,
    browserNavigationVerified:false,productionHealthVerified:false,releaseApproved:false,
  });
}
const isSha=v=>typeof v==='string'&&SHA.test(v);
export function assessSmallzReleaseEvidence({service,deployment,githubMainSha,ownerRead}={}){
  const servicePinned=service?.id===RENDER_ID
    &&service?.name==='smallz-hercules'
    &&service?.repo==='https://github.com/'+REPO_SLUG
    &&service?.branch==='main'
    &&service?.serviceDetails?.url===SERVICE_URL
    &&service?.serviceDetails?.runtime==='node'
    &&service?.suspended==='not_suspended';
  const deployedSha=deployment?.commit?.id;
  const providerRecordConsistent=servicePinned&&deployment?.status==='live'&&isSha(deployedSha);
  const githubHeadAlignment=!providerRecordConsistent||!isSha(githubMainSha)?'unverified'
    :deployedSha===githubMainSha?'matches_main':'different_from_main';
  const identity=ownerRead?.identity;
  const ownerRuntimeIdentityAligned=providerRecordConsistent
    &&ownerRead?.status==='observed'
    &&ownerRead?.authenticatedControlReadObserved===true
    &&identity?.schema==='sauceapproved.hercules.smallz-runtime-identity.v1'
    &&identity?.ownerAuthenticatedIdentityOnly===true
    &&identity?.externalControlReadObserved===true
    &&identity?.service==='smallz'
    &&identity?.renderServiceId===RENDER_ID
    &&identity?.repository===REPO_SLUG
    &&identity?.branch==='main'
    &&identity?.commitSha===deployedSha;
  return Object.freeze({
    schema:'sauceapproved.hercules.smallz-release-proof.v1',
    providerRecordConsistent:Boolean(providerRecordConsistent),
    providerDeployedCommit:providerRecordConsistent?deployedSha:null,
    githubHeadAlignment,
    ownerRuntimeIdentityAligned:Boolean(ownerRuntimeIdentityAligned),
    providerSourceAuthenticatedByThisCode:false,
    browserNavigationVerified:false,productionHealthVerified:false,
    paymentFlowVerified:false,releaseApproved:false,
    authority:Object.freeze({deploy:false,payment:false,approval:false}),
  });
}
async function readBoundedJson(response){
  if(!response.body||typeof response.body.getReader!=='function')return null;
  const reader=response.body.getReader(),chunks=[];
  let bytes=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))return null;
      bytes+=value.byteLength;
      if(bytes>MAX_IDENTITY_BYTES)return null;
      chunks.push(value);
    }
  }finally{try{await reader.cancel()}catch{/* Cancellation is not evidence. */}}
  const combined=new Uint8Array(bytes);
  let offset=0;
  for(const part of chunks){combined.set(part,offset);offset+=part.byteLength}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(combined))}catch{return null}
}
export async function probeSmallzOwnerIdentity({ownerAuthorization,fetchImpl=fetch}={}){
  const empty=Object.freeze({status:'not_attempted',identity:null,authenticatedControlReadObserved:false});
  if(typeof ownerAuthorization!=='string'
    ||ownerAuthorization.length>8199
    ||!/^Bearer [^\s]{10,8192}$/iu.test(ownerAuthorization))return empty;
  if(typeof fetchImpl!=='function')throw new TypeError('fetchImpl must be a function');
  try{
    const response=await fetchImpl(IDENTITY_URL,{
      method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',
      headers:{accept:'application/json',authorization:ownerAuthorization},
      signal:AbortSignal.timeout(4000),
    });
    if(response?.status!==200||response.redirected===true
      ||!/^application\/json(?:\s*;|\s*$)/iu.test(response.headers?.get('content-type')??''))
      return {status:'unverified',identity:null,authenticatedControlReadObserved:false};
    const identity=await readBoundedJson(response);
    const valid=identity?.schema==='sauceapproved.hercules.smallz-runtime-identity.v1'
      &&identity?.service==='smallz'&&identity?.renderServiceId===RENDER_ID
      &&identity?.repository===REPO_SLUG&&identity?.branch==='main'
      &&isSha(identity?.commitSha)
      &&identity?.ownerAuthenticatedIdentityOnly===true
      &&identity?.externalControlReadObserved===true;
    if(!valid)return {status:'unverified',identity:null,authenticatedControlReadObserved:false};
    return {status:'observed',authenticatedControlReadObserved:true,identity:Object.freeze({
      schema:identity.schema,service:'smallz',renderServiceId:RENDER_ID,
      repository:REPO_SLUG,branch:'main',commitSha:identity.commitSha,
      ownerAuthenticatedIdentityOnly:true,externalControlReadObserved:true,
    })};
  }catch{
    return {status:'unverified',identity:null,authenticatedControlReadObserved:false};
  }
}
