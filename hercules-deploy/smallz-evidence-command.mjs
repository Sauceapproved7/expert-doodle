/**
 * Hercules Smallz command: read-only evidence from already-authorized
 * dedicated server-side GitHub and Render tokens.
 *
 * No credential provisioning, secret readback, write-capable token fallback,
 * arbitrary URL, deploy, rollback, billing or authorization capability.
 */
import {createSmallzProviderReaders} from './smallz-provider-readers.mjs';
import {collectSmallzEvidence} from './smallz-evidence-bridge.mjs';

const SCHEMA='sauceapproved.hercules.smallz-evidence-command.v1';
const BASE=Object.freeze({
  schema:SCHEMA,
  status:'HOLD',
  reasonCodes:Object.freeze(['DEDICATED_READ_CREDENTIALS_UNAVAILABLE']),
  evidence:null,
  providerQueriesAttempted:false,
  snapshotStability:'unverified',
  providerRecordsIndependentlyAuthenticated:false,
  ownerAuthorizationVerified:false,
  runtimeHealthVerified:false,
  releaseApproved:false,
  productionChanged:false,
  executionAuthority:false
});
function hold(code) {
  return Object.freeze({...BASE,reasonCodes:Object.freeze([code])});
}
function validCredential(token){
  return typeof token==='string'
    &&token.length>=24&&token.length<=512
    &&!/\s/u.test(token);
}

/**
 * Reads exactly two dedicated, already-provisioned env slots.
 * Intentionally does not use HERCULES_RENDER_API_TOKEN or generic GITHUB_TOKEN.
 * The env getter and provider errors must never propagate sensitive strings.
 */
export async function inspectSmallzFromRuntime({env=process.env,fetchImpl=globalThis.fetch}={}){
  let render,github;
  try{
    render=env?.HERCULES_SMALLZ_RENDER_READ_TOKEN;
    github=env?.HERCULES_SMALLZ_GITHUB_READ_TOKEN;
  }catch{
    return hold('DEDICATED_READ_CREDENTIALS_UNAVAILABLE');
  }
  if(!validCredential(render)||!validCredential(github))
    return hold('DEDICATED_READ_CREDENTIALS_UNAVAILABLE');
  try{
    const readers=createSmallzProviderReaders({
      renderApiToken:render,
      githubApiToken:github,
      fetchImpl
    });
    // Sequential double-read detects drift during a single inspection.
    // Two consistent caller-provided snapshots still do NOT authenticate
    // the provider, establish freshness, or authorize production actions.
    const first=await collectSmallzEvidence(readers);
    const second=await collectSmallzEvidence(readers);
    if(JSON.stringify(first)!==JSON.stringify(second)){
      return Object.freeze({
        ...hold('PROVIDER_STATE_CHANGED_DURING_READ'),
        providerQueriesAttempted:true,
        snapshotStability:'changed'
      });
    }
    // Repeated matching errors are not a stable release observation.
    const verifiedShape=first.mainCommit!==null
      &&first.liveCommit!==null
      &&first.liveDeploymentId!==null
      &&!first.reasonCodes.includes('PROVIDER_READ_FAILED');
    if(!verifiedShape){
      return Object.freeze({
        ...hold('PROVIDER_READ_FAILED'),
        providerQueriesAttempted:true
      });
    }
    // A caller-provided fetch can be a test double. We do not promote
    // correlated JSON to independent provider or owner authentication.
    return Object.freeze({
      ...BASE,
      status:second.status,
      reasonCodes:Object.freeze([...second.reasonCodes]),
      evidence:second,
      providerQueriesAttempted:true,
      snapshotStability:'stable'
    });
  }catch{
    return Object.freeze({...hold('PROVIDER_READ_FAILED'),providerQueriesAttempted:true});
  }
}
function argsAllowed(args){
  return Array.isArray(args)
    &&(args.length===0||(args.length===1&&args[0]==='--json'));
}
/**
 * Local/server CLI interface, not an HTTP route. The only supported flag is
 * --json (no custom URLs, token literals, provider writes or "approve" modes).
 */
export async function runSmallzEvidenceReadCommand({
  argv=[],env=process.env,fetchImpl=globalThis.fetch,
  write=text=>process.stdout.write(text)
}={}){
  const output=argsAllowed(argv)
    ?await inspectSmallzFromRuntime({env,fetchImpl})
    :hold('UNSUPPORTED_ARGUMENTS');
  write(JSON.stringify(output)+'\n');
  return output.status==='CONSISTENT_UNATTESTED'?0:2;
}
