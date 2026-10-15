/**
 * SauceApproved-owned guard for the one approved Studio founding-access page.
 * All write callers must already pass the Hercules owner/admin/internal gate.
 * This is NOT a new endpoint, grant, release approval or publisher.
 */
export const STUDIO_OFFER_SLUG='sauceapproved-studio-offer';
export const STUDIO_APPROVED_SHA='8743e3ffc127f61d48aa9d2eb9058847e32b2ff51489367d2f59f3b54ef23a9b';
export const STUDIO_LEGACY_SHA='bf087ccd55cfbe172c049b1d1db5882aeac2cac73aa33fec1839c951c1fc41ff';
const STUDIO_PUBLIC_URL='https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/';
const MAX_BYTES=65536;
const enc=new TextEncoder();
async function digest(value){
  const bytes=typeof value==='string'?enc.encode(value):value;
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
const fail=(reason,extra={})=>({ok:false,reason,...extra});
function plausibleSha(x){return typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)}
export async function studioReleaseSourceCheck({slug,html,claimedSha,previousSha}={}){
  if(slug!==STUDIO_OFFER_SLUG||typeof html!=='string'||!html.startsWith('<!doctype html>')||enc.encode(html).length>MAX_BYTES)return fail('unapproved_source');
  if(claimedSha!==STUDIO_APPROVED_SHA||previousSha!==STUDIO_LEGACY_SHA)return fail('source_provenance_missing');
  const observed=await digest(html);
  return observed===STUDIO_APPROVED_SHA?{ok:true,sha256:observed}:fail('source_hash_mismatch');
}
async function readBoundedHtml(response){
  if(!response?.body?.getReader)return null;
  const reader=response.body.getReader(),parts=[];
  let bytes=0;
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))return null;
      bytes+=value.byteLength;
      if(bytes>MAX_BYTES)return null;
      parts.push(value);
    }
    const out=new Uint8Array(bytes);
    let offset=0;
    for(const chunk of parts){out.set(chunk,offset);offset+=chunk.byteLength;}
    return out;
  }finally{try{await reader.cancel()}catch{}}
}
export async function verifyStudioPublicArtifact({
  url,expectedSha,fetchImpl=fetch,sleepImpl=async ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}){
  if(url!==STUDIO_PUBLIC_URL||!plausibleSha(expectedSha)||typeof fetchImpl!=='function')return fail('invalid_verification_target');
  let lastStatus=null;
  for(const attempt of [1,2,3]){
    try {
      const response=await fetchImpl(url,{
        method:'GET',redirect:'manual',credentials:'omit',
        cache:'no-store',referrerPolicy:'no-referrer',
        headers:{accept:'text/html'},signal:AbortSignal.timeout(8000),
      });
      lastStatus=response.status;
      if(response.status===503){
        try{await response.body?.cancel()}catch{}
        if(attempt<3){await sleepImpl(6000);continue}
        return fail('temporary_unavailable',{status:503,attempts:attempt});
      }
      if(response.status!==200||response.redirected||
         !/^text\/html(?:\s*;|\s*$)/i.test(response.headers?.get('content-type')||'')){
        return fail('invalid_response',{status:response.status,attempts:attempt});
      }
      const contentLen=Number(response.headers?.get('content-length')||0);
      if(contentLen>MAX_BYTES)return fail('body_too_large',{attempts:attempt});
      const bytes=await readBoundedHtml(response);
      if(!bytes)return fail('body_unavailable_or_too_large',{attempts:attempt});
      const observedSha256=await digest(bytes);
      return {
        ok:observedSha256===expectedSha,
        reason:observedSha256===expectedSha?'exact_bytes_observed':'source_hash_mismatch',
        status:200,attempts:attempt,observedSha256,bytes:bytes.length,
      };
    }catch{
      return fail('request_unavailable',{status:lastStatus,attempts:attempt});
    }
  }
  return fail('verification_unavailable',{status:lastStatus,attempts:3});
}
/**
 * Storage read/write receives only scoped authorized controller operations.
 * Storage rollback is best-effort, NOT transactional or concurrency-safe.
 */
export async function guardedStudioPresentationWrite({
  slug,html,claimedSha,previousSha,pinnedPreviousSha,
  storage,publicUrl,fetchImpl=fetch,sleepImpl,
}={}){
  if(slug!==STUDIO_OFFER_SLUG||claimedSha!==STUDIO_APPROVED_SHA||
     typeof html!=='string'||typeof storage?.read!=='function'||typeof storage?.write!=='function'||
     !plausibleSha(previousSha)||previousSha!==pinnedPreviousSha||publicUrl!==STUDIO_PUBLIC_URL){
    return fail('unapproved_release_request',{rolledBack:false});
  }
  if(await digest(html)!==STUDIO_APPROVED_SHA){
    return fail('source_hash_mismatch',{rolledBack:false});
  }
  let previous;
  try{previous=await storage.read()}catch{return fail('previous_source_unavailable',{rolledBack:false})}
  if(typeof previous!=='string'||enc.encode(previous).length>MAX_BYTES||
     await digest(previous)!==previousSha){
    return fail('previous_source_changed',{rolledBack:false});
  }
  let verification=null;
  try{
    await storage.write(html);
    verification=await verifyStudioPublicArtifact({
      url:publicUrl,expectedSha:claimedSha,fetchImpl,sleepImpl,
    });
    if(verification.ok){
      return {ok:true,reason:'exact_public_source_verified',sha256:claimedSha,
        previousSha256:previousSha,verification,rolledBack:false};
    }
  }catch{/* a rejected Storage write may still have mutated its object */}
  let current;
  try{current=await storage.read()}catch{
    return fail('rollback_state_unavailable',{rolledBack:false});
  }
  if(typeof current!=='string')return fail('rollback_state_unavailable',{rolledBack:false});
  const currentSha=await digest(current);
  if(currentSha!==claimedSha){
    return fail(currentSha===previousSha?'verification_failed_no_change':'verification_failed_concurrent_change',{rolledBack:false,verification});
  }
  try{
    await storage.write(previous);
    const restored=await storage.read();
    if(typeof restored!=='string'||await digest(restored)!==previousSha){
      return fail('rollback_not_verified',{rolledBack:false,verification});
    }
    return fail('public_verification_failed_storage_restored',{rolledBack:true,verification});
  }catch{return fail('rollback_failed',{rolledBack:false,verification})}
}
