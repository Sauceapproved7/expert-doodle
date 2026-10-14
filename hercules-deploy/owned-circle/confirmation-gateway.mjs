// Hercules Circle original HTTP confirmation gateway.
// This is an independent SERVER-SIDE handler, never bundled into the static site.
// No SMTP, checkout, secret, or subscriber list endpoint is provided.
// Production is HELD until durable rate controls, verified transport/receipt,
// trusted readiness, and an owner-authorized separate host are proven.
const STATIC_ORIGIN='https://hercules-owned-circle-free.onrender.com';
const REQUEST_PATH='/api/confirm/request';
const VERIFY_PATH='/api/confirm/verify';
const HEALTH='/health';
const EMAIL=/^[a-z0-9][a-z0-9._+%-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/;
const TOKEN=/^[a-f0-9]{64}$/;
const MAX_BYTES=2048;
const HOUR=3600000;
const MAX_EVIDENCE_AGE_MS=120000;
const FUTURE_SKEW_MS=5000;
const READINESS_CHECK_TIMEOUT_MS=2000;
const REQUIRED_PROOFS=Object.freeze([
 'senderDomainVerified','providerConnectionVerified','outboundReceiptVerified',
 'durableRateLimitReady','privateChallengeStoreReady','ownerReleaseApproved'
]);
function currentEvidence(evidence,stamp){
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))return false;
 if(!Number.isSafeInteger(stamp)||!Number.isSafeInteger(evidence.checkedAt))return false;
 if(evidence.checkedAt>stamp+FUTURE_SKEW_MS||stamp-evidence.checkedAt>MAX_EVIDENCE_AGE_MS)return false;
 return REQUIRED_PROOFS.every(key=>evidence[key]===true);
}
function json(res,status,data,allowOrigin=false){
 const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'vary':'Origin'
 };
 if(allowOrigin)headers['access-control-allow-origin']=STATIC_ORIGIN;
 res.writeHead(status,headers);
 res.end(JSON.stringify(data));
}
async function bodyObject(request){
 const type=String(request.headers['content-type']??'');
 if(!/^application\/json(?:\s*;|$)/i.test(type))throw Object.assign(Error('unsupported_content_type'),{status:415});
 const length=Number(request.headers['content-length']??0);
 if(!Number.isSafeInteger(length)||length>MAX_BYTES)throw Object.assign(Error('payload_too_large'),{status:413});
 let size=0;
 const parts=[];
 for await(const chunk of request){
  size+=chunk.length;
  if(size>MAX_BYTES)throw Object.assign(Error('payload_too_large'),{status:413});
  parts.push(chunk);
 }
 let value;
 try{value=JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Object.assign(Error('invalid_json'),{status:400})}
 if(!value||Array.isArray(value)||typeof value!=='object')throw Object.assign(Error('invalid_payload'),{status:400});
 return value;
}
function fieldsExactly(payload,keys){
 const actual=Object.keys(payload);
 return actual.length===keys.length&&actual.every(key=>keys.includes(key));
}
export function createCircleConfirmationApi({
 engine,readiness,now=Date.now,maxRequestsPerHour=5
}={}){
 if(typeof engine?.request!=='function'||typeof engine?.confirm!=='function')
  throw Error('private_confirmation_engine_required');
 if(typeof now!=='function'||!Number.isInteger(maxRequestsPerHour)||maxRequestsPerHour<1||maxRequestsPerHour>60)
  throw Error('invalid_gateway_options');
 // A client or static configuration must never assert an operational release.
 // This function must be implemented by a trusted backend that independently
 // checks provider, delivery receipt, durable abuse controls and owner release.
 async function activeNow(){
  if(typeof readiness!=='function')return false;
  let timer;
  try{
   const evidence=await Promise.race([
    Promise.resolve().then(()=>readiness()),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('readiness_timeout')),READINESS_CHECK_TIMEOUT_MS)})
   ]);
   return currentEvidence(evidence,now());
  }catch{return false}
  finally{clearTimeout(timer)}
 }
 const counts=new Map();
 function limit(ip){
  const stamp=now();
  if(!Number.isSafeInteger(stamp))return false;
  // Refuse rather than unboundedly accumulating arbitrary request identifiers.
  if(counts.size>10000)return false;
  const old=counts.get(ip);
  const state=old&&stamp-old.start<HOUR?old:{start:stamp,count:0};
  state.count+=1;
  counts.set(ip,state);
  return state.count<=maxRequestsPerHour;
 }
 return async function handler(req,res){
  const path=(req.url??'').split('?')[0];
  const method=req.method??'GET';
  if(path===HEALTH&&method==='GET'){
   json(res,200,{ok:true,service:'hercules-owned-circle-confirmation',confirmation:(await activeNow())?'eligible':'held'});
   return;
  }
  if(![REQUEST_PATH,VERIFY_PATH].includes(path)){
   json(res,404,{ok:false,error:'not_found'});return;
  }
  const cors=req.headers.origin===STATIC_ORIGIN;
  if(!cors){
   json(res,403,{ok:false,error:'origin_not_allowed'});return;
  }
  if(method==='OPTIONS'){
   res.writeHead(204,{
    'access-control-allow-origin':STATIC_ORIGIN,
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-allow-headers':'content-type',
    'access-control-max-age':'600',
    'cache-control':'no-store','vary':'Origin'
   });
   res.end();return;
  }
  if(method!=='POST'){
   json(res,405,{ok:false,error:'method_not_allowed'},true);return;
  }
  let input;
  try{input=await bodyObject(req)}
  catch(error){const status=[400,413,415].includes(error?.status)?error.status:400;json(res,status,{ok:false,error:error?.message??'invalid_payload'},true);return}
  if(path===REQUEST_PATH&&(!fieldsExactly(input,['email'])||typeof input.email!=='string'||input.email.length>254)){
   json(res,400,{ok:false,error:'invalid_request'},true);return;
  }
  if(path===VERIFY_PATH&&(!fieldsExactly(input,['token'])||typeof input.token!=='string'||!TOKEN.test(input.token))){
   json(res,400,{ok:false,error:'invalid_or_expired_token'},true);return;
  }
  if(!(await activeNow())){
   json(res,503,{ok:false,error:'confirmation_held'},true);return;
  }
  // Only use the actual socket address; X-Forwarded-For is client-controlled.
  const peer=req.socket.remoteAddress||'unknown';
  if(!limit(peer)){
   json(res,429,{ok:false,error:'too_many_requests'},true);return;
  }
  if(path===REQUEST_PATH){
   const email=input.email.trim().toLowerCase();
   if(email.length<5||email.includes('..')||!EMAIL.test(email)){
    json(res,400,{ok:false,error:'invalid_request'},true);return;
   }
   try{await engine.request(email)}
   catch{
    // Intentionally no enumeration of found, consented, unverified addresses.
    // Private failure details must be handled through authorized internal logs.
   }
   json(res,202,{ok:true,status:'request_received'},true);
   return;
  }
  try{
   const result=await engine.confirm(input.token);
   if(result?.ok!==true||result.status!=='email_confirmed_no_entitlement')
    throw Error('confirmation_not_recorded');
   json(res,200,{ok:true,status:'email_confirmed_no_entitlement'},true);
  }catch(error){
   const replay=error?.message==='invalid_or_expired_token';
   json(res,replay?400:503,{ok:false,error:replay?'invalid_or_expired_token':'confirmation_unavailable'},true);
  }
 };
}
