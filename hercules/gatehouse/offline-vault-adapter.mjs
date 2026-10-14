/**
 * Gatehouse isolated service-only Supabase Vault RPC adapter.
 * No database connection, service key, browser route or Shopify credential is
 * created here. It must be instantiated ONLY by a verified private owner
 * worker with a confidential service-role client; disabled by default.
 * SQL RPCs must enforce their own service role and owner membership.
 */
const ORG="ea5fb196-67f9-42fa-b592-49eeb3b84346";
const SHOP="azymhc-x0.myshopify.com";
const SHOP_ID="gid://shopify/Shop/100002726208";
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS=/^shpat_[A-Za-z0-9._-]{16,4000}$/;
const REFRESH=/^shprt_[A-Za-z0-9._-]{16,4000}$/;
const fault=()=>new Error("private-vault-not-ready");
const validTime=value=>typeof value==="string"&&value.length<=40&&Number.isFinite(Date.parse(value));
const validPair=(row)=>{
 if(!row||!ACCESS.test(row.accessToken||"")||!REFRESH.test(row.refreshToken||"")
  ||row.accessToken===row.refreshToken||
  !validTime(row.expiresAt)||!validTime(row.refreshExpiresAt))return false;
 return Date.parse(row.refreshExpiresAt)>Date.parse(row.expiresAt);
};
const singleData=x=>Array.isArray(x)?x.length===1?x[0]:null:x;
export function createGatehouseOfflineVaultAdapter({
 enabled=false,workerAuthorized=false,ownerSessionVerified=false,
 organizationId="",ownerUserId="",rpc=null
}={}){
 const ready=enabled===true&&workerAuthorized===true&&
  ownerSessionVerified===true&&organizationId===ORG&&UID.test(ownerUserId)&&
  typeof rpc==="function";
 async function call(name,params){
  if(!ready)throw fault();
  try{
   const result=await rpc(name,params);
   if(result?.error)throw fault();
   return singleData(result?.data);
  }catch{throw fault()}
 }
 async function storePrivateGrant(row){
  if(!ready||!row||row.shopDomain!==SHOP||!validPair(row))throw fault();
  const data=await call("gatehouse_offline_bootstrap",{
   p_organization_id:ORG,p_owner_user_id:ownerUserId,
   p_access_token:row.accessToken,p_refresh_token:row.refreshToken,
   p_access_expires_at:row.expiresAt,p_refresh_expires_at:row.refreshExpiresAt
  });
  if(data?.stored!==true||data?.generation!==1)throw fault();
  return {stored:true,generation:1};
 }
 async function acquireExclusiveGrantLease(requestedOrganization){
  if(!ready||requestedOrganization!==ORG)return null;
  let row;
  try{row=await call("gatehouse_offline_acquire",{
   p_organization_id:ORG,p_owner_user_id:ownerUserId
  })}catch{return null}
  if(!row||row.leased!==true||row.organization_id!==ORG||
    row.shop_domain!==SHOP||row.shop_gid!==SHOP_ID||
    !UID.test(row.lease_nonce||"")||
    !Number.isSafeInteger(row.generation)||row.generation<0||
    !REFRESH.test(row.refresh_token||"")||
    !validTime(row.access_expires_at)||
    !validTime(row.refresh_expires_at))return null;
  const capturedGeneration=row.generation,nonce=row.lease_nonce;
  const oldRefresh=row.refresh_token;
  let released=false;
  async function commitRotation(update){
   if(released||!update||update.organizationId!==ORG||
    update.expectedGeneration!==capturedGeneration||
    update.shopDomain!==SHOP||update.shopGid!==SHOP_ID||
    update.refreshToken===oldRefresh||
    !validPair({
     accessToken:update.accessToken,refreshToken:update.refreshToken,
     expiresAt:update.accessExpiresAt,refreshExpiresAt:update.refreshExpiresAt
    }))throw fault();
   const result=await call("gatehouse_offline_commit",{
    p_organization_id:ORG,p_owner_user_id:ownerUserId,
    p_lease_nonce:nonce,p_expected_generation:capturedGeneration,
    p_access_token:update.accessToken,p_refresh_token:update.refreshToken,
    p_access_expires_at:update.accessExpiresAt,
    p_refresh_expires_at:update.refreshExpiresAt
   });
   if(result?.stored===true&&result.generation===capturedGeneration+1)
    return {stored:true,generation:capturedGeneration+1};
   return {stored:false,generation:capturedGeneration};
  }
  async function release(){
   if(released)return;
   released=true;
   const result=await call("gatehouse_offline_release",{
    p_organization_id:ORG,p_owner_user_id:ownerUserId,p_lease_nonce:nonce
   });
   if(result?.released!==true)throw fault();
  }
  return {
   leased:true,organizationId:ORG,shopDomain:SHOP,shopGid:SHOP_ID,
   generation:capturedGeneration,refreshToken:oldRefresh,
   accessExpiresAt:row.access_expires_at,
   refreshExpiresAt:row.refresh_expires_at,commitRotation,release
  };
 }
 return {storePrivateGrant,acquireExclusiveGrantLease};
}
