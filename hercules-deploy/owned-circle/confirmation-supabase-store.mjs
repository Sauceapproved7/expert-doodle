// HERCULES OWNED CIRCLE — SERVER-ONLY SUPABASE CHALLENGE STORE
// No Supabase SDK or runtime dependencies beyond fetch.
// Never import into HTML/browser: this module requires a private backend token.
const DATABASE_ORIGIN='https://xbwuablxhhwsaoomsoco.supabase.co';
const FOUNDER='hercules_cloud_founders';
const CHALLENGES='hercules_circle_confirmation_challenges';
const HASH=/^[a-f0-9]{64}$/;
const EMAIL=/^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/;
function address(value){
 if(typeof value!=='string'||value.length<5||value.length>254||value!==value.toLowerCase()||value.includes('..')||!EMAIL.test(value))
  throw Error('invalid_confirmation_address');
 return value;
}
function digest(value){
 if(typeof value!=='string'||!HASH.test(value))throw Error('invalid_confirmation_digest');
 return value;
}
function validTime(value){
 if(!Number.isSafeInteger(value)||value<0)throw Error('invalid_confirmation_time');
 return new Date(value).toISOString();
}
export function createSupabaseConfirmationStore({
 fetchImpl=fetch,adminToken,origin=DATABASE_ORIGIN
}={}){
 if(origin!==DATABASE_ORIGIN)throw Error('database_origin_not_allowlisted');
 if(typeof fetchImpl!=='function')throw Error('fetch_required');
 if(typeof adminToken!=='string'||adminToken.length<32)
  throw Error('private_server_token_required');
 if(typeof window!=='undefined')throw Error('private_backend_only');
 const common=Object.freeze({
  apikey:adminToken,
  authorization:'Bearer '+adminToken,
  accept:'application/json'
 });
 async function request(path,{method='GET',body,prefer,expectedShape='array'}={}){
  const headers={...common};
  if(body!==undefined)headers['content-type']='application/json';
  if(prefer)headers.prefer=prefer;
  let response;
  try{
   response=await fetchImpl(origin+'/rest/v1/'+path,{
    method,headers,credentials:'omit',redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(9000),
    ...(body===undefined?{}:{body:JSON.stringify(body)})
   });
  }catch{throw Error('owner_database_unavailable')}
  if(response.status===409&&method==='POST')return {duplicate:true};
  if(!response.ok)throw Error('owner_database_unavailable');
  // PostgREST's return=minimal has no response body.
  if(response.status===201&&prefer==='return=minimal')return {};
  let data;
  try{data=await response.json()}catch{throw Error('owner_database_unavailable')}
  if(expectedShape==='object'){
   if(!data||Array.isArray(data)||typeof data!=='object')throw Error('owner_database_unavailable');
  }else if(!Array.isArray(data))throw Error('owner_database_unavailable');
  return data;
 }
 const eq=value=>encodeURIComponent('eq.'+value);
 return Object.freeze({
  async eligible(raw){
   const email=address(raw);
   const items=await request(FOUNDER+'?email='+eq(email)+'&select=email,status,consent_at&limit=1');
   if(items.length!==1)return null;
   const item=items[0];
   if(item.email!==email||item.status!=='unverified'||typeof item.consent_at!=='string')return null;
   return {email,status:item.status,consentAt:item.consent_at};
  },
  async reserve({email,tokenDigest,issuedAt,expiresAt}){
   address(email);digest(tokenDigest);
   const issued=validTime(issuedAt),expires=validTime(expiresAt);
   if(expiresAt<=issuedAt||expiresAt-issuedAt>24*3600000)throw Error('invalid_confirmation_expiration');
   const result=await request(CHALLENGES,{
    method:'POST',
    body:{email,token_digest:tokenDigest,status:'reserved',issued_at:issued,expires_at:expires},
    prefer:'return=minimal'
   });
   return result.duplicate!==true;
  },
  async markSent({email,tokenDigest,at}){
   address(email);digest(tokenDigest);
   const matches=await request(CHALLENGES+
    '?email='+eq(email)+'&token_digest='+eq(tokenDigest)+'&status='+eq('reserved')+'&select=email',{
      method:'PATCH',body:{status:'sent',sent_at:validTime(at)},prefer:'return=representation'
    });
   if(matches.length!==1||matches[0]?.email!==email)throw Error('confirmation_mark_sent_failed');
  },
  async revoke({email,tokenDigest}){
   address(email);digest(tokenDigest);
   await request(CHALLENGES+
    '?email='+eq(email)+'&token_digest='+eq(tokenDigest)+'&status=in.(reserved,sent)&select=email',{
      method:'PATCH',body:{status:'revoked'},prefer:'return=representation'
    });
  },
  async consume({tokenDigest,now}){
   digest(tokenDigest);
   validTime(now);
   // Service-role-only SECURITY INVOKER RPC updates founder status and
   // single-use challenge inside one Postgres transaction. Never do this
   // with separate client-side PATCH requests.
   const result=await request('rpc/hercules_circle_consume_confirmation',{
    method:'POST',body:{p_token_digest:tokenDigest},expectedShape:'object'
   });
   if(result.ok===false&&result.status==='invalid_or_expired')return null;
   if(result.ok!==true||result.status!=='email_confirmed_no_entitlement')
    throw Error('owner_database_unavailable');
   const email=result.email;
   return {email:address(email),confirmed:true};
  }
 });
}
