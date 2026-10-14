/**
 * Server-only, never-mounted prototype for first-party Shopify embedded ID-token exchange.
 * Requires a separately authenticated Hercules organization owner and a legitimately
 * retrieved matching Shopify app secret. NEVER expose credentials through public routes.
 * No checkout, webhook, payout, customer reads, report write, or automatic token recovery.
 */
import {createHmac,timingSafeEqual} from "node:crypto";

const CLIENT_ID="1ed12710f0b797a7a3328c1cf4e8b1f9";
const SHOP_DOMAIN="azymhc-x0.myshopify.com";
const SHOP_ID="gid://shopify/Shop/100002726208";
const API="https://"+SHOP_DOMAIN+"/admin/api/2026-10/graphql.json";
const TOKEN_URL="https://"+SHOP_DOMAIN+"/admin/oauth/access_token";
const SAFE_TOKEN=/^[A-Za-z0-9._-]{20,4096}$/;
const deny=()=>({status:503,body:{
 status:"HOLD",readOrdersVerified:false,shopGidVerified:false,
 checkoutEnabled:false,deliveryAuthorized:false,providerPayoutVerified:false,
 tokenStoredPrivately:false
}});
const validSecret=s=>typeof s==="string"&&s.length>=32&&s.length<=4096&&!/[\x00-\x1f\x7f]/.test(s);
const decodeJson=part=>{
 if(!/^[A-Za-z0-9_-]+$/.test(part))throw Error("bad-base64url");
 const b=Buffer.from(part,"base64url");
 if(!b.length||b.toString("base64url")!==part||b.length>4096)throw Error("bad-json");
 return JSON.parse(b.toString("utf8"));
};
function pinnedUrl(value,issuer){
 if(typeof value!=="string")throw Error("invalid-url");
 const x=new URL(value);
 if(x.protocol!=="https:"||x.hostname!==SHOP_DOMAIN||x.port||
  x.username||x.password||x.search||x.hash||
  x.pathname!==(issuer?"/admin":"/"))throw Error("invalid-shop");
}
export function verifyEmbeddedShopifyIdToken({idToken,clientId,clientSecret,now=Date.now()}={}){
 if(typeof idToken!=="string"||idToken.length>4096
  ||clientId!==CLIENT_ID||!validSecret(clientSecret)
  ||!Number.isSafeInteger(now)||now<0)throw Error("invalid-id-token");
 const parts=idToken.split(".");
 if(parts.length!==3)throw Error("invalid-id-token");
 const header=decodeJson(parts[0]),claims=decodeJson(parts[1]);
 if(header?.alg!=="HS256"||header?.typ!=="JWT"||
  header.crit!==undefined||header.jku!==undefined||header.x5u!==undefined)
  throw Error("invalid-id-token");
 if(!/^[A-Za-z0-9_-]+$/.test(parts[2]))throw Error("invalid-id-token");
 const expected=createHmac("sha256",clientSecret)
  .update(parts[0]+"."+parts[1]).digest();
 const actual=Buffer.from(parts[2],"base64url");
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))
  throw Error("invalid-id-token");
 const time=Math.floor(now/1000);
 if(claims?.aud!==CLIENT_ID||typeof claims.sub!=="string"
  ||!claims.sub.length||claims.sub.length>256||
  !Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat)
  ||!Number.isSafeInteger(claims.nbf)
  ||claims.exp<=time||claims.exp-time>120||
  claims.iat>time||time-claims.iat>120||
  claims.nbf>time||claims.exp<=claims.nbf)
  throw Error("invalid-id-token");
 pinnedUrl(claims.iss,true);
 pinnedUrl(claims.dest,false);
 // Only a fixed shop hint leaves this verifier, never JWT subject or token.
 return {shopDomain:SHOP_DOMAIN};
}
export function createEmbeddedShopifyReadOnlyGrant({
 enabled=false,ownerAuthenticated=false,clientId="",clientSecret="",
 idToken="",now=Date.now(),fetcher=fetch,storePrivateGrant=null
}={}){
 async function run(){
  if(enabled!==true||ownerAuthenticated!==true||
   typeof storePrivateGrant!=="function")return deny();
  try{
   verifyEmbeddedShopifyIdToken({idToken,clientId,clientSecret,now});
  }catch{return deny()}
  try{
   const response=await fetcher(TOKEN_URL,{
    method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),
    headers:{"content-type":"application/x-www-form-urlencoded","accept":"application/json"},
    body:new URLSearchParams({
     client_id:clientId,client_secret:clientSecret,
     grant_type:"urn:ietf:params:oauth:grant-type:token-exchange",
     subject_token:idToken,
     subject_token_type:"urn:ietf:params:oauth:token-type:id_token",
     requested_token_type:"urn:shopify:params:oauth:token-type:offline-access-token",
     expiring:"1"
    })
   });
   if(response?.status!==200||response.ok!==true)return deny();
   const grant=await response.json();
   const scopes=new Set(typeof grant?.scope==="string"
    ?grant.scope.split(",").map(x=>x.trim()):[]);
   if(!SAFE_TOKEN.test(grant?.access_token||"")||
    !SAFE_TOKEN.test(grant?.refresh_token||"")||
    !scopes.has("read_orders")||
    !Number.isSafeInteger(grant.expires_in)||grant.expires_in<60||grant.expires_in>86400||
    !Number.isSafeInteger(grant.refresh_token_expires_in)||
    grant.refresh_token_expires_in<=grant.expires_in||
    grant.refresh_token_expires_in>31536000)return deny();
   const proof=await fetcher(API,{
    method:"POST",redirect:"error",signal:AbortSignal.timeout(10000),
    headers:{"content-type":"application/json","accept":"application/json",
     "X-Shopify-Access-Token":grant.access_token},
    body:JSON.stringify({query:"query GatehouseEmbeddedGrantProof { shop { id myshopifyDomain } orders(first:1) { pageInfo { hasNextPage } } }"})
   });
   if(proof?.status!==200||proof.ok!==true)return deny();
   const body=await proof.json();
   if(body?.errors?.length||body?.data?.shop?.id!==SHOP_ID||
    body?.data?.shop?.myshopifyDomain!==SHOP_DOMAIN||
    typeof body?.data?.orders?.pageInfo?.hasNextPage!=="boolean")return deny();
   // This callback MUST be a privileged, owner-scoped, transactional private Vault
   // write before the caller may report success. Not implemented or enabled here.
   await storePrivateGrant({
    accessToken:grant.access_token,
    refreshToken:grant.refresh_token,
    shopDomain:SHOP_DOMAIN,
    expiresAt:new Date(now+grant.expires_in*1000).toISOString(),
    refreshExpiresAt:new Date(now+grant.refresh_token_expires_in*1000).toISOString()
   });
   return {status:200,body:{
    status:"private-owner-read-only-grant-stored",
    readOrdersVerified:true,shopGidVerified:true,tokenStoredPrivately:true,
    checkoutEnabled:false,deliveryAuthorized:false,providerPayoutVerified:false
   }};
  }catch{return deny()}
 }
 return {run};
}
