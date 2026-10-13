const ORIGIN='https://sauceapproved-studio.onrender.com';
const BACKEND='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?studio_access=1';
const BASE_HEADERS=Object.freeze({'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'});
const HTML_HEADERS=Object.freeze({...BASE_HEADERS,'content-type':'text/html; charset=utf-8',
 'content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://esm.sh; style-src 'unsafe-inline'; connect-src 'self' https://xbwuablxhhwsaoomsoco.supabase.co https://esm.sh; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
function error(status,code){return {status,headers:{...BASE_HEADERS,'content-type':'application/json; charset=utf-8'},body:JSON.stringify({ok:false,error:code})};}
async function boundedText(response){
 const reader=response.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144)throw Error('response_too_large');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}return new TextDecoder().decode(bytes);
}

// Public rendering relay only. Auth and paid-entitlement authority remain in Hercules.
export async function studioActivation(request,{fetchUpstream=fetch}={}){
 const method=String(request.method||'GET').toUpperCase();
 if(!['GET','POST'].includes(method))return error(405,'method_not_allowed');
 const options={method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{}};
 if(method==='POST'){
  if(request.headers?.origin!==ORIGIN)return error(403,'same_origin_required');
  if(!String(request.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))return error(400,'json_required');
  if(typeof request.body!=='string'||Buffer.byteLength(request.body)>4096)return error(413,'request_too_large');
  let input;try{input=JSON.parse(request.body);}catch{return error(400,'invalid_json');}
  if(input?.action==='studio_access_request'){
   if(typeof input.email!=='string'||input.email.length>254)return error(400,'invalid_email');
   options.body=JSON.stringify({action:input.action,email:input.email});
  }else if(input?.action==='studio_purchase_claim'){
   const bearer=request.headers?.authorization;
   if(typeof bearer!=='string'||!/^Bearer [A-Za-z0-9._-]{1,4096}$/.test(bearer))return error(401,'authenticated_user_required');
   options.headers.authorization=bearer;options.body=JSON.stringify({action:input.action});
  }else{return error(400,'unsupported_activation_action');}
  options.headers['content-type']='application/json';
 }
 try{
  const response=await fetchUpstream(BACKEND,options);
  if(response.status>=300&&response.status<400)return error(502,'activation_upstream_unavailable');
  const body=await boundedText(response);
  if(method==='GET'){
   if(response.status!==200||!body.startsWith('<!doctype html>')||!body.includes('<title>SauceApproved Studio Access</title>')||!body.includes('studio_purchase_claim'))return error(502,'activation_page_unavailable');
   return {status:200,headers:HTML_HEADERS,body};
  }
  // Only documented activation responses are projected; no upstream headers/cookies.
  let result;try{result=JSON.parse(body);}catch{return error(502,'activation_upstream_unavailable');}
  if(![200,400,401,403,409].includes(response.status)||!result||typeof result!=='object'||Array.isArray(result))return error(502,'activation_upstream_unavailable');
  return {status:response.status,headers:{...BASE_HEADERS,'content-type':'application/json; charset=utf-8'},body};
 }catch{return error(502,'activation_upstream_unavailable');}
 finally{delete options.body;delete options.headers.authorization;}
}
