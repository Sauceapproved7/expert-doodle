import {createHmac} from 'node:crypto';
import {createSmallzTraceRpc,decodeTraceKeyFromBase64} from './prompt-trace-ingress.mjs';

const ACTIONS=new Set(['bot_browser_navigate','bot_browser_scrape']);

/**
 * Sign only trusted server-authenticated browser-intent metadata.
 * Page text, URLs, form data and credentials are deliberately not accepted
 * into the signed event. Sign BEFORE attempting the browser action.
 */
export function createSmallzTraceEmitter({signingKey,reserveSequence,ingestTrace}={}){
  if(!Buffer.isBuffer(signingKey)||signingKey.length<32)throw new TypeError('invalid_trace_key');
  if(typeof reserveSequence!=='function'||typeof ingestTrace!=='function')throw new TypeError('trace_emitter_dependency_required');
  let tail=Promise.resolve();
  return ({action}={})=>{
    if(!ACTIONS.has(action))return Promise.reject(new Error('unsupported_trace_action'));
    const task=tail.then(async()=>{
    const source='smallz';
    const sequence=await reserveSequence(source);
    if(!Number.isSafeInteger(sequence)||sequence<1)throw new Error('invalid_trace_sequence');
    const event={kind:'agent_message',text:'smallz_owner_browser_intent:'+action};
    const mac=createHmac('sha256',signingKey)
      .update(JSON.stringify({source,sequence,event})).digest('hex');
    const receipt=await ingestTrace({source,sequence,event,mac});
    if(!receipt||receipt.accepted!==true||receipt.source!=='browser:smallz'||receipt.sequence!==sequence)
      throw new Error('trace_receipt_unverified');
    return Object.freeze({accepted:true,source:receipt.source,sequence:receipt.sequence,digest:receipt.digest??null});
    });
    // Keep one worker's reservation, signing and claim in sequence even if
    // a prior event fails. The caller still receives its original rejection.
    tail=task.catch(()=>{});
    return task;
  };
}

/** Disabled unless an independent server-side signer and RPC are configured. */
export function createSmallzTraceEmitterFromEnv(env={}, {traceIngress,fetchImpl=fetch}={}){
  if(typeof traceIngress!=='function')return null;
  const projectUrl=env.HERCULES_PROMPT_TRACE_PROJECT_URL;
  const serverKey=env.HERCULES_PROMPT_TRACE_SERVER_KEY;
  const signingKey=decodeTraceKeyFromBase64(env.HERCULES_PROMPT_TRACE_HMAC_KEY_B64);
  if(!projectUrl||!serverKey||!signingKey)return null;
  try{
    const rpc=createSmallzTraceRpc({projectUrl,serverKey,fetchImpl});
    return createSmallzTraceEmitter({
      signingKey,
      reserveSequence:source=>rpc('hercules_prompt_trace_reserve_sequence',{p_source:source}),
      ingestTrace:traceIngress
    });
  }catch{return null;}
}
