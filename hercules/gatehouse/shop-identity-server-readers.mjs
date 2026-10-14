/**
 * Gatehouse v2.18 — server-only read-only identity readers.
 *
 * DO NOT import into a browser, expose as a public route, or pass credentials
 * from a request body. The caller must be an authenticated PRIVATE worker
 * that supplies legitimate shop-specific Admin and Supabase service credentials
 * through its confidential runtime. Not connected, deployed or enabled.
 *
 * Identity agreement is never payment, read_orders, app-install or fulfillment
 * authorization. No network call occurs until enabled and both keys exist.
 */
const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const PROJECT="xbwuablxhhwsaoomsoco";
const SHOP="azymhc-x0.myshopify.com";
const GRAPHQL_URL="https://"+SHOP+"/admin/api/2026-10/graphql.json";
const DB_ORIGIN="https://"+PROJECT+".supabase.co";
const MAX_JSON_BYTES=8192;
const QUERY="query GatehouseReadOnlyShopIdentity { shop { id myshopifyDomain } }";
const err=()=>new Error("gatehouse-private-identity-unavailable");
const privateCredential=x=>typeof x==="string"&&x.length>=8&&x.length<=4096&&!/[\r\n\x00-\x1f]/.test(x);
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);

async function boundedJson(fetchImpl,url,options){
 let response;
 try{response=await fetchImpl(url,{
  ...options,redirect:"error",cache:"no-store",
  signal:AbortSignal.timeout(5000)
 })}catch{throw err()}
 if(!response||response.ok!==true||response.status!==200||
  !/^application\/(?:json|[^;]+\+json)(?:;|$)/i.test(response.headers?.get("content-type")||""))
  throw err();
 const declared=Number(response.headers?.get("content-length")||"0");
 if(!Number.isFinite(declared)||declared>MAX_JSON_BYTES)throw err();
 const reader=response.body?.getReader?.();
 if(!reader)throw err();
 let received=0,buffer="";
 const decoder=new TextDecoder("utf-8",{fatal:true});
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   received+=value?.byteLength||0;
   if(received>MAX_JSON_BYTES)throw err();
   buffer+=decoder.decode(value,{stream:true});
  }
  buffer+=decoder.decode();
  return JSON.parse(buffer);
 }catch{throw err()}
 finally{try{await reader.cancel()}catch{}}
}
function fixedUrl(table,select,extra=""){
 // No caller-derived URL, schema, table or query parameter is accepted.
 return DB_ORIGIN+"/rest/v1/"+table+"?select="+select+
  "&organization_id=eq."+ORG+extra+"&limit=2";
}

export function createGatehouseServerIdentityReaders({
 enabled=false,fetchImpl=null,
 shopifyAdminToken="",supabaseServiceRoleKey=""
}={}){
 const ready=enabled===true&&typeof fetchImpl==="function"&&
  privateCredential(shopifyAdminToken)&&privateCredential(supabaseServiceRoleKey);
 const refuseIfDisabled=()=>{if(!ready)throw err()};
 const supabaseHeaders=()=>({
  apikey:supabaseServiceRoleKey,
  Authorization:"Bearer "+supabaseServiceRoleKey,
  Accept:"application/json"
 });
 const dbQuery=async url=>boundedJson(fetchImpl,url,{
  method:"GET",headers:supabaseHeaders()
 });
 async function readShopifyIdentity(){
  refuseIfDisabled();
  const response=await boundedJson(fetchImpl,GRAPHQL_URL,{
   method:"POST",
   headers:{
    "X-Shopify-Access-Token":shopifyAdminToken,
    "Content-Type":"application/json",
    Accept:"application/json"
   },
   body:JSON.stringify({query:QUERY})
  });
  if(!isObject(response)||response.errors!==undefined||
   !isObject(response.data)||!isObject(response.data.shop)||
   typeof response.data.shop.id!=="string"||
   typeof response.data.shop.myshopifyDomain!=="string")throw err();
  return {
   id:response.data.shop.id,
   myshopifyDomain:response.data.shop.myshopifyDomain
  };
 }
 async function readProviderIdentity(){
  refuseIfDisabled();
  // Select only non-secret scalars; NEVER load token/secret refs or the entire
  // provider metadata JSON. The canonical row and isolated Gatehouse row
  // must both exist, each exactly once, and agree on the shop and app.
  const canonical=await dbQuery(fixedUrl(
   "hercules_provider_connections",
   "organization_id,provider,client_id,status,shop_domain:metadata->>shop_domain",
   "&provider=eq.shopify"
  ));
  const gatehouse=await dbQuery(fixedUrl(
   "gatehouse_shopify_readonly_connections",
   "organization_id,client_id,shop_gid,shop_domain,status"
  ));
  if(!Array.isArray(canonical)||canonical.length!==1||
     !Array.isArray(gatehouse)||gatehouse.length!==1)throw err();
  const c=canonical[0],g=gatehouse[0];
  if(!isObject(c)||!isObject(g)||
   c.organization_id!==ORG||g.organization_id!==ORG||
   c.provider!=="shopify"||c.status!=="active"||
   g.status!=="readback-only"||
   typeof c.shop_domain!=="string"||typeof g.shop_domain!=="string"||
   !c.client_id||!g.client_id||
   c.shop_domain!==g.shop_domain||c.client_id!==g.client_id)
   throw err();
  return {
   organizationId:ORG,
   shopDomain:g.shop_domain,
   shopGid:g.shop_gid,
   clientId:g.client_id
  };
 }
 return {readShopifyIdentity,readProviderIdentity};
}
