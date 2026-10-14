/**
 * Isolated Gatehouse Shopify expiring offline token refresh contract.
 * NOT imported by a public route, NOT enabled, NOT connected to Supabase Vault.
 * A future first-party privileged worker must enforce durable per-organization
 * exclusive leases and atomic CAS storage for both token refs in one transaction.
 * No authorization, order, payout, checkout or customer-delivery action exists here.
 */
const CLIENT_ID="1ed12710f0b797a7a3328c1cf4e8b1f9";
const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const SHOP_DOMAIN="azymhc-x0.myshopify.com";
const SHOP_GID="gid://shopify/Shop/100002726208";
const SHOP_URL="https://"+SHOP_DOMAIN;
const TOKEN_URL=SHOP_URL+"/admin/oauth/access_token";
const API_URL=SHOP_URL+"/admin/api/2026-10/graphql.json";
const TOKEN=/^(?:shpat_|shprt_)[A-Za-z0-9._-]{16,4000}$/;
const RECEIPT_MIN_MS=60000;
const hold=status=>({status:503,body:{
 status,purchaseEnabled:false,checkoutEnabled:false,deliveryAuthorized:false,
 payoutVerified:false,customerEntitlementGranted:false,providerOrderReadVerified:false
}});
const safe=status=>({status:200,body:{
 status,purchaseEnabled:false,checkoutEnabled:false,deliveryAuthorized:false,
 payoutVerified:false,customerEntitlementGranted:false,providerOrderReadVerified:false
}});
const secretOk=x=>typeof x==="string"&&x.length>=32&&x.length<=4096&&!/[\x00-\x1f\x7f]/.test(x);
const at=x=>typeof x==="string"&&x.length<=40?Date.parse(x):NaN;
function validLease(lease,organizationId,now){
 if(!lease||lease.leased!==true||lease.organizationId!==organizationId
  ||lease.shopDomain!==SHOP_DOMAIN||lease.shopGid!==SHOP_GID
  ||!Number.isSafeInteger(lease.generation)||lease.generation<0
  ||!TOKEN.test(lease.refreshToken||"")||!lease.refreshToken.startsWith("shprt_")
  ||typeof lease.commitRotation!=="function"||typeof lease.release!=="function")
  return false;
 const refreshExpiry=at(lease.refreshExpiresAt);
 const accessExpiry=at(lease.accessExpiresAt);
 return Number.isFinite(accessExpiry)&&Number.isFinite(refreshExpiry)
  &&refreshExpiry>now&&refreshExpiry-now<=31536000000
  &&accessExpiry>0;
}
async function refreshToken(clientId,clientSecret,storedRefresh,fetcher){
 let response;
 try{
  response=await fetcher(TOKEN_URL,{
   method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),
   headers:{"content-type":"application/x-www-form-urlencoded",accept:"application/json"},
   body:new URLSearchParams({
    grant_type:"refresh_token",client_id:clientId,client_secret:clientSecret,
    refresh_token:storedRefresh
   })
  });
 }catch{return {status:"retry-later"}}
 if(response?.status===401)return {status:"reauthorization-required"};
 if(response?.status===429||response?.status>=500)return {status:"retry-later"};
 if(response?.status!==200||response.ok!==true)return {status:"HOLD"};
 let grant;
 try{grant=await response.json()}catch{return {status:"HOLD"}}
 const scopes=new Set(typeof grant?.scope==="string"
  ?grant.scope.split(",").map(x=>x.trim()):[]);
 if(!TOKEN.test(grant?.access_token||"")||
  !grant.access_token.startsWith("shpat_")||
  !TOKEN.test(grant?.refresh_token||"")||
  !grant.refresh_token.startsWith("shprt_")||
  grant.refresh_token===storedRefresh||
  !scopes.has("read_orders")||
  !Number.isSafeInteger(grant.expires_in)||grant.expires_in<60||
  grant.expires_in>86400||
  !Number.isSafeInteger(grant.refresh_token_expires_in)||
  grant.refresh_token_expires_in<=grant.expires_in||
  grant.refresh_token_expires_in>31536000)
  return {status:"HOLD"};
 return {status:"grant",grant};
}
async function attestAccess(accessToken,fetcher){
 try{
  const response=await fetcher(API_URL,{
   method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),
   headers:{"content-type":"application/json",accept:"application/json",
    "X-Shopify-Access-Token":accessToken},
   body:JSON.stringify({query:"query GatehouseOfflineRefreshProof { shop { id myshopifyDomain } orders(first:1) { pageInfo { hasNextPage } } }"})
  });
  if(response?.status!==200||response.ok!==true)return false;
  const data=await response.json();
  return !data?.errors?.length&&data?.data?.shop?.id===SHOP_GID
   &&data?.data?.shop?.myshopifyDomain===SHOP_DOMAIN
   &&typeof data?.data?.orders?.pageInfo?.hasNextPage==="boolean";
 }catch{return false}
}
export function createEmbeddedShopifyOfflineRefresh({
 enabled=false,workerAuthorized=false,organizationId="",clientId="",
 clientSecret="",now=Date.now(),fetcher=fetch,acquireExclusiveGrantLease
}={}){
 async function run(){
  if(enabled!==true||workerAuthorized!==true||organizationId!==ORG
   ||clientId!==CLIENT_ID||!secretOk(clientSecret)
   ||!Number.isSafeInteger(now)||now<0
   ||typeof acquireExclusiveGrantLease!=="function")
   return hold("HOLD");
  let lease;
  try{lease=await acquireExclusiveGrantLease(organizationId)}
  catch{return hold("HOLD")}
  if(!lease)return hold("HOLD");
  // Leasing and storage must be provided by a trusted server implementation.
  // This module does not create persistence, transactions, or a distributed lock.
  let outcome=hold("HOLD");
  try{
   if(!validLease(lease,organizationId,now))return outcome;
   if(at(lease.accessExpiresAt)>now+RECEIPT_MIN_MS){
    outcome=safe("refresh-not-due");
   }else{
    const result=await refreshToken(clientId,clientSecret,lease.refreshToken,fetcher);
    if(result.status!=="grant"){
     outcome=hold(result.status);
    }else if(!await attestAccess(result.grant.access_token,fetcher)){
     outcome=hold("HOLD");
    }else{
     const nextVersion=lease.generation+1;
     const stored=await lease.commitRotation({
      organizationId,expectedGeneration:lease.generation,
      accessToken:result.grant.access_token,
      refreshToken:result.grant.refresh_token,
      shopDomain:SHOP_DOMAIN,shopGid:SHOP_GID,
      accessExpiresAt:new Date(now+result.grant.expires_in*1000).toISOString(),
      refreshExpiresAt:new Date(now+result.grant.refresh_token_expires_in*1000).toISOString()
     });
     if(stored?.stored===true&&stored.generation===nextVersion)
      outcome=safe("refreshed-in-private-vault");
    }
   }
  }catch{
   outcome=hold("HOLD");
  }finally{
   try{await lease.release()}catch{outcome=hold("HOLD")}
  }
  return outcome;
 }
 return {run};
}
