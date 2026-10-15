import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2';
import {CANONICAL_SHOP,SHOPIFY_ORDER_QUERY,summarizeShopifyOrders,verifyOrderScope} from './gatehouse-shopify-readback.mjs';

/** Separate authenticated owner-only reader. No mutations, receipts, customer PII, or entitlement writes. */
const U=Deno.env.get('SUPABASE_URL')||'';
const A=Deno.env.get('SUPABASE_ANON_KEY')||
 JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||'';
const S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||
 JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||'';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'x-frame-options':'DENY'}
});

async function getOwnerConnection(req:Request){
 const header=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(header))return null;
 const token=header.slice(7);
 if(!U||!A||!S)return null;
 const userClient=createClient(U,A,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await userClient.auth.getUser(token);
 if(authError||!user)return null;
 const admin=createClient(U,S,{auth:{persistSession:false}});
 const {data:memberships,error:membershipError}=await admin.from('hercules_memberships')
  .select('organization_id,role').eq('user_id',user.id).eq('status','active')
  .in('role',['owner','admin']).limit(10);
 if(membershipError||!memberships?.length)return null;
 const {data:connections,error:connectionError}=await admin.from('hercules_provider_connections')
  .select('organization_id,provider,account_key,client_id,secret_ref,status')
  .eq('provider','shopify').eq('account_key',CANONICAL_SHOP).eq('status','active')
  .limit(10);
 if(connectionError||!connections)return null;
 const allowed=connections.filter((c:any)=>memberships.some((m:any)=>
  String(m.organization_id)===String(c.organization_id)&&
  verifyOrderScope({provider:c.provider,shopDomain:c.account_key,
   connectionStatus:c.status,membershipActive:true,role:m.role})));
 if(allowed.length!==1)return null;
 return {admin,connection:allowed[0]};
}
async function accessToken(admin:any,c:any){
 if(!c?.client_id||!c?.secret_ref)throw Error('provider-configuration-unavailable');
 const {data:secret,error}=await admin.rpc('hercules_get_secret',{p_id:c.secret_ref});
 if(error||typeof secret!=='string'||!secret)throw Error('provider-credential-unavailable');
 const response=await fetch('https://'+CANONICAL_SHOP+'/admin/oauth/access_token',{
  method:'POST',redirect:'error',
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'client_credentials',
   client_id:String(c.client_id),client_secret:secret}),
  signal:AbortSignal.timeout(12000)
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok||typeof body.access_token!=='string')throw Error('provider-token-unavailable');
 return body.access_token;
}
async function recentOrders(token:string){
 const response=await fetch('https://'+CANONICAL_SHOP+'/admin/api/2026-10/graphql.json',{
  method:'POST',redirect:'error',
  headers:{'content-type':'application/json','x-shopify-access-token':token},
  body:JSON.stringify({query:SHOPIFY_ORDER_QUERY,variables:{first:10}}),
  signal:AbortSignal.timeout(16000)
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body.errors?.length||!body.data)throw Error('readback-not-available');
 return summarizeShopifyOrders(body.data);
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='GET')return json({error:'method-not-allowed'},405);
 let owner;
 try{owner=await getOwnerConnection(req)}
 catch{return json({error:'owner-authorization-not-available'},503)}
 if(!owner)return json({error:'owner-authorization-required'},401);
 try{
  const token=await accessToken(owner.admin,owner.connection);
  const summary=await recentOrders(token);
  return json({
   status:'readback-completed',shopDomain:CANONICAL_SHOP,
   observedAt:new Date().toISOString(),
   ...summary,ownerSessionRequired:true,
   note:'Authenticated Shopify provider readback of the latest 10 orders. Matching candidates are NOT verified report delivery, buyer identity, payout, or permission to publish a product.'
  });
 }catch{
  return json({status:'readback-unavailable',error:'provider-readback-not-confirmed',
   deliveryAuthorized:false,purchaseEnabled:false},503);
 }
});
