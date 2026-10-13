import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';
import {normalizeCustomerRequest,buildTenantSiteRow,publicAccountState,assessDelivery} from './client-onboarding.mjs';

/** Gatehouse customer onboarding API. Separate, owner-JWT-only, zero checkout/scan/delivery. */
const U=Deno.env.get('SUPABASE_URL')||'';
const P=Deno.env.get('SUPABASE_ANON_KEY')||
 JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||'';
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||
 JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||'';
function response(status:number,data:unknown){
 return new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json','cache-control':'no-store',
   'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
   'x-frame-options':'DENY','permissions-policy':'camera=(), geolocation=()'}
 });
}
async function jsonBodyLimited(req:Request){
 if(!req.headers.get('content-type')?.startsWith('application/json'))
  throw new Error('json-required');
 const reader=req.body?.getReader();
 if(!reader)throw new Error('invalid-body');
 const chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>2048)throw new Error('body-too-large');
   chunks.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error}
 const raw=new Uint8Array(size);let pos=0;
 for(const bytes of chunks){raw.set(bytes,pos);pos+=bytes.byteLength}
 let value:unknown;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}
 catch{throw new Error('invalid-json')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid-json');
 return value;
}
async function authenticatedUser(req:Request){
 const authorization=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)||!U||!P||!S)return null;
 const token=authorization.slice(7);
 const client=createClient(U,P,{auth:{persistSession:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user||user.is_anonymous===true)return null;
 return user;
}
Deno.serve(async(req:Request)=>{
 const path=new URL(req.url).pathname.split('/').filter(Boolean).at(-1);
 if(req.method!=='GET'&&req.method!=='POST')return response(405,{error:'method-not-allowed'});
 const user=await authenticatedUser(req).catch(()=>null);
 if(!user)return response(401,{error:'authenticated-customer-required'});
 const admin=createClient(U,S,{auth:{persistSession:false}});
 if(req.method==='GET'&&path==='status')
  return response(200,{service:'gatehouse-customer-intake',accountVerified:true,
   ...assessDelivery(),mode:'customer-authenticated-website-intake-only'});
 if(req.method==='GET'&&path==='sites'){
  const {data,error}=await admin.from('gatehouse_customer_sites')
   .select('id,origin,stage,authorized_at')
   .eq('owner_user_id',user.id).order('created_at',{ascending:false}).limit(25);
  if(error)return response(503,{error:'private-site-storage-unavailable'});
  return response(200,{sites:data||[],purchaseEnabled:false,deliveryAuthorized:false});
 }
 if(req.method==='GET'&&path==='reports'){
  const {data,error}=await admin.from('gatehouse_customer_reports')
   .select('id,site_id,delivery_state,created_at')
   .eq('owner_user_id',user.id).order('created_at',{ascending:false}).limit(25);
  if(error)return response(503,{error:'private-report-storage-unavailable'});
  return response(200,{reports:data||[],reportDeliveryEnabled:false,subscriptionBillingEnabled:false});
 }
 if(req.method==='POST'&&path==='sites'){
  let submitted:unknown;
  try{submitted=await jsonBodyLimited(req)}
  catch(error){return response(400,{error:error instanceof Error?error.message:'invalid-request'})}
  let row;
  try{
   normalizeCustomerRequest(submitted);
   row=buildTenantSiteRow({userId:user.id,submitted});
  }catch{return response(422,{error:'site-consent-or-origin-invalid'})}
  // Upsert intentionally avoided. An existing consent record is not silently replaced.
  const {data,error}=await admin.from('gatehouse_customer_sites')
    .insert({...row,owner_user_id:user.id})
    .select('id,stage').single();
  if(error){
   if(error.code==='23505')return response(409,{error:'site-already-registered'});
   return response(503,{error:'private-site-storage-unavailable'});
  }
  return response(201,{siteId:data.id,...publicAccountState(data)});
 }
 return response(404,{error:'route-not-available',...assessDelivery()});
});
