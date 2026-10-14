/**
 * Hercules Smallz read-only audit: server-only credential custody boundary.
 * No endpoint, cron, provider writes, log output or approval authority.
 * Requires an exact opt-in and credentials separate from deploy/control tokens.
 * Provider-read tokens' actual scopes must be checked by the provider owner.
 */
import {createSmallzProviderReaders} from './smallz-provider-readers.mjs';
import {collectSmallzEvidence} from './smallz-evidence-bridge.mjs';

const MAX_TOKEN_LENGTH=512;
const READ_RENDER='HERCULES_SMALLZ_RENDER_READ_TOKEN';
const READ_GITHUB='HERCULES_SMALLZ_GITHUB_READ_TOKEN';
const WRITE_NAMES=Object.freeze([
  'HERCULES_RENDER_API_TOKEN',
  'HERCULES_DEPLOY_CONTROL_TOKEN',
  'RENDER_API_KEY',
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY'
]);
const tokenValid=value=>typeof value==='string'
  &&value.length>=24&&value.length<=MAX_TOKEN_LENGTH&&!/\s/u.test(value);
const field=(obj,key)=>Object.hasOwn(obj,key)?obj[key]:undefined;
const baseline=(status,code)=>Object.freeze({
  schema:'sauceapproved.hercules.smallz-read-audit.v1',
  status,reasonCodes:[code],
  serviceId:'srv-db08fglg1s2s73d0o2rg',
  mainCommit:null,liveCommit:null,liveDeploymentId:null,
  providerRecordsIndependentlyAuthenticated:false,
  recordFreshnessIndependentlyVerified:false,
  ownerAuthorizationVerified:false,
  ownerRuntimeRecordAligned:false,
  runtimeHealthVerified:false,
  productionChanged:false,
  networkOperationsPerformedByModule:false,
  releaseApproved:false,executionAuthority:false
});

/**
 * Explicit, one-shot server-side audit. The env object is supplied by the
 * authorized caller; no Supabase Vault or credential store is accessed here.
 * Crucially, do not fall back to the ordinary deployment tokens.
 */
export async function runSmallzReleaseReadAudit({env={},fetchImpl=globalThis.fetch}={}){
  if(!env||typeof env!=='object'||Array.isArray(env))
    return baseline('DISABLED','AUDIT_DISABLED');
  if(field(env,'HERCULES_SMALLZ_READ_AUDIT_ENABLED')!=='true')
    return baseline('DISABLED','AUDIT_DISABLED');

  const render=field(env,READ_RENDER);
  const github=field(env,READ_GITHUB);
  if(!tokenValid(render)||!tokenValid(github))
    return baseline('HOLD','DEDICATED_READ_CREDENTIALS_REQUIRED');

  const reused=render===github||WRITE_NAMES.some(name=>{
    const existing=field(env,name);
    return typeof existing==='string'&&existing.length>0
      &&(render===existing||github===existing);
  });
  if(reused)return baseline('HOLD','CREDENTIAL_BOUNDARY_VIOLATION');

  try{
    const readers=createSmallzProviderReaders({
      renderApiToken:render,
      githubApiToken:github,
      fetchImpl
    });
    // Sequential, normalized reads detect mid-inspection drift. They are
    // advisory: agreement alone is neither independent authentication nor an
    // atomic multi-provider snapshot and never grants execution authority.
    const first=await collectSmallzEvidence(readers);
    const second=await collectSmallzEvidence(readers);
    if(JSON.stringify(first)!==JSON.stringify(second)){
      return Object.freeze({
        ...baseline('HOLD','PROVIDER_STATE_CHANGED_DURING_READ'),
        snapshotStability:'changed',
        networkOperationsPerformedByModule:true
      });
    }
    // Matching error records are not valid evidence of stable provider state.
    if(first.mainCommit===null||first.liveCommit===null
      ||first.liveDeploymentId===null
      ||first.reasonCodes.includes('PROVIDER_READ_FAILED')){
      return Object.freeze({
        ...baseline('HOLD','PROVIDER_READ_FAILED'),
        snapshotStability:'unverified',
        networkOperationsPerformedByModule:true
      });
    }
    return Object.freeze({
      ...second,
      schema:'sauceapproved.hercules.smallz-read-audit.v1',
      snapshotStability:'stable',
      networkOperationsPerformedByModule:true,
      providerRecordsIndependentlyAuthenticated:false,
      recordFreshnessIndependentlyVerified:false,
      ownerAuthorizationVerified:false,
      runtimeHealthVerified:false,
      releaseApproved:false,executionAuthority:false,
      productionChanged:false
    });
  }catch{
    // Never return raw upstream errors, credentials or private response data.
    return baseline('HOLD','PROVIDER_READ_FAILED');
  }
}
