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
    const evidence=await collectSmallzEvidence(readers);
    // A caller-provided fetch can be a test double. This module never upgrades
    // caller claims to independently verified provider, runtime or owner proof.
    return Object.freeze({
      ...BASE,
      status:evidence.status,
      reasonCodes:Object.freeze([...evidence.reasonCodes]),
      evidence,
      providerQueriesAttempted:true
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
