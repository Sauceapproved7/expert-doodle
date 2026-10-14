/**
 * Hercules Smallz server-side read-only readiness runner.
 * Fixed, no-write GitHub/Render evidence reads using separate server-custodied
 * credentials. The report is advisory and cannot attest independent provider
 * identity, owner authorization, runtime health or production readiness.
 *
 * NOT an HTTP route and NOT a deployer. Only the explicit CLI '--read-only'
 * switch can run this standalone entry point. No third-party dependencies.
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSmallzProviderReaders} from './smallz-provider-readers.mjs';
import {collectSmallzEvidence} from './smallz-evidence-bridge.mjs';

const SERVICE_ID='srv-db08fglg1s2s73d0o2rg';
const SHA=/^[a-f0-9]{40}$/u;
const DEPLOY_ID=/^dep-[A-Za-z0-9_-]{8,80}$/u;

function hold(reason){
  return Object.freeze({
    schema:'sauceapproved.hercules.smallz-readiness-runner.v1',
    status:'HOLD',reasonCodes:[reason],
    serviceId:SERVICE_ID,mainCommit:null,liveCommit:null,liveDeploymentId:null,
    readsAttempted:false,ownerRuntimeRecordAligned:false,
    providerRecordsIndependentlyAuthenticated:false,
    ownerAuthorizationVerified:false,runtimeHealthVerified:false,
    productionChanged:false,releaseApproved:false,executionAuthority:false,
  });
}
const credential=v=>typeof v==='string'&&v.length>=24&&v.length<=512&&!/\s/u.test(v);
const safeSha=v=>typeof v==='string'&&SHA.test(v)?v:null;
const safeDeploy=v=>typeof v==='string'&&DEPLOY_ID.test(v)?v:null;

/**
 * No implicit reading from process.env here. The standalone entry point
 * passes process.env only upon explicit execution with '--read-only'.
 * Caller-injected fetch in tests is not a provider trust anchor.
 */
export async function runSmallzReadiness({env={},fetchImpl=globalThis.fetch}={}){
  const e=env&&typeof env==='object'&&!Array.isArray(env)?env:{};
  if(e.HERCULES_SMALLZ_EVIDENCE_READ_ENABLED!=='true')
    return hold('READ_ONLY_MODE_DISABLED');
  const render=e.HERCULES_SMALLZ_RENDER_READ_TOKEN;
  const github=e.HERCULES_SMALLZ_GITHUB_READ_TOKEN;
  if(!credential(render)||!credential(github))
    return hold('READ_CREDENTIALS_UNAVAILABLE');

  // Do not silently reuse credentials previously intended for writing,
  // running the worker, or administering the Deploy Plane. These checks do
  // not independently verify the actual provider privileges of a token.
  const privileged=[
    e.HERCULES_RENDER_API_TOKEN,e.HERCULES_DEPLOY_CONTROL_TOKEN,
    e.RENDER_API_KEY,e.GITHUB_TOKEN,e.GH_TOKEN
  ].filter(x=>typeof x==='string'&&x.length);
  if(render===github||privileged.includes(render)||privileged.includes(github))
    return hold('CREDENTIAL_ROLE_COLLISION');
  if(typeof fetchImpl!=='function')return hold('PROVIDER_READ_FAILED');

  try{
    const readers=createSmallzProviderReaders({
      renderApiToken:render,githubApiToken:github,fetchImpl
    });
    const evidence=await collectSmallzEvidence(readers);
    const reasons=Array.isArray(evidence?.reasonCodes)
      ?evidence.reasonCodes.filter(x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{0,127}$/u.test(x)).sort()
      :['PROVIDER_READ_FAILED'];
    const status=evidence?.status==='CONSISTENT_UNATTESTED'&&reasons.length===0
      ?'CONSISTENT_UNATTESTED':'HOLD';
    return Object.freeze({
      schema:'sauceapproved.hercules.smallz-readiness-runner.v1',
      status,reasonCodes:reasons.length||status==='CONSISTENT_UNATTESTED'
        ?[...new Set(reasons)]:['PROVIDER_READ_FAILED'],
      serviceId:SERVICE_ID,
      mainCommit:safeSha(evidence?.mainCommit),
      liveCommit:safeSha(evidence?.liveCommit),
      liveDeploymentId:safeDeploy(evidence?.liveDeploymentId),
      readsAttempted:true,
      ownerRuntimeRecordAligned:false,
      providerRecordsIndependentlyAuthenticated:false,
      ownerAuthorizationVerified:false,runtimeHealthVerified:false,
      productionChanged:false,releaseApproved:false,executionAuthority:false,
    });
  }catch{
    // Exception text may contain provider credentials, network headers, or
    // user-supplied content; never include exception messages in reports.
    return hold('PROVIDER_READ_FAILED');
  }
}

/** Running this file directly never falls through into deployment code. */
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
