import {ingestBrowserTrace} from '../hercules-runtime/prompt-intelligence/trace.mjs';
import {createDurableReplayClaim} from '../hercules-runtime/prompt-intelligence/durable-replay.mjs';

const SOURCE = 'smallz';
const REF = /^[a-z0-9]{15,40}\.supabase\.co$/;

function validatedProject(value) {
  try {
    if(typeof value!=='string') throw Error('invalid');
    const target=new URL(value);
    if(target.protocol!=='https:' || !REF.test(target.hostname) ||
      target.username || target.password || target.port ||
      (target.pathname!=='' && target.pathname!=='/') ||
      target.search || target.hash) throw Error('invalid');
    return target.origin;
  }catch{ throw new TypeError('invalid_trace_project'); }
}
export function decodeTraceKeyFromBase64(value){
  if(typeof value!=='string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  const decoded=Buffer.from(value,'base64');
  return decoded.length>=32 && decoded.toString('base64')===value ? decoded:null;
}

/**
 * Opt-in Smallz owner-only signed-trace ingestion. A signed emitter is
 * authenticated; its content NEVER authorizes tool actions. The response
 * is metadata-only and never returns raw browser page text, URL or credentials.
 */
/** Fixed-target, server-only RPC connector; never pass name or URL from page content. */
export function createSmallzTraceRpc({projectUrl,serverKey,fetchImpl=fetch}={}){
  const project=validatedProject(projectUrl);
  if(typeof serverKey!=='string'||serverKey.length<8 || /[\r\n]/.test(serverKey))throw new TypeError('invalid_trace_server_key');
  if(typeof fetchImpl!=='function')throw new TypeError('trace_fetch_required');
  const allowed=new Set(['hercules_prompt_trace_claim_sequence','hercules_prompt_trace_reserve_sequence']);
  return async (name,args)=>{
    if(!allowed.has(name))throw new Error('trace_rpc_denied');
    const endpoint=project+'/rest/v1/rpc/'+name;
    const headers={'content-type':'application/json','accept':'application/json','apikey':serverKey};
    if(serverKey.split('.').length===3)headers.authorization='Bearer '+serverKey;
    let response;
    try{
      response=await fetchImpl(endpoint,{
        method:'POST',headers,body:JSON.stringify(args),redirect:'error',
        referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)
      });
    }catch{throw new Error('trace_rpc_unavailable');}
    if(!response||response.ok!==true)throw new Error('trace_rpc_unavailable');
    try{return await response.json();}
    catch{throw new Error('trace_rpc_unavailable');}
  };
}

/** Verify signature and accept only metadata as the outward receipt. */
export function createSmallzTraceIngress({projectUrl,serverKey,signingKey,fetchImpl=fetch}={}){
  if(!Buffer.isBuffer(signingKey)||signingKey.length<32)throw new TypeError('invalid_trace_key');
  const rpc=createSmallzTraceRpc({projectUrl,serverKey,fetchImpl});
  const claimSequence=createDurableReplayClaim({rpc});
  return async envelope=>{
    const event=await ingestBrowserTrace(envelope,{
      keyForSource:async source=>source===SOURCE?signingKey:null,
      claimSequence
    });
    // Untrusted page text, browser URL and tool payload never enter this receipt.
    return Object.freeze({
      accepted:true,source:event.source,sequence:event.sequence,
      digest:event.digest,kind:event.kind,
      ...(event.kind==='tool_attempt'?{allowed:false}:{}),
    });
  };
}

/** No credentials or listener are configured unless all server-only settings exist. */
export function createSmallzTraceIngressFromEnv(env={},options={}){
  const projectUrl=env.HERCULES_PROMPT_TRACE_PROJECT_URL;
  const serverKey=env.HERCULES_PROMPT_TRACE_SERVER_KEY;
  const encoded=env.HERCULES_PROMPT_TRACE_HMAC_KEY_B64;
  if(!projectUrl||!serverKey||!encoded)return null;
  const signingKey=decodeTraceKeyFromBase64(encoded);
  if(!signingKey)return null;
  try{return createSmallzTraceIngress({projectUrl,serverKey,signingKey,...options});}
  catch{return null;}
}
