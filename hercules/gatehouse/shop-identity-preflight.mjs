/**
 * Review-only Gatehouse v2.17: compare independent, backend-read Shopify and
 * Supabase shop identities before private Vault RPCs. This is an identity
 * consistency check, NOT provider OAuth, paid-order proof or launch approval.
 *
 * The two functions must be implemented by trusted private server readers.
 * Never accept shop identity objects or "verified" booleans from a browser,
 * webhook, customer request, or an unauthenticated API parameter.
 */
const PINNED=Object.freeze({
 organizationId:"ea5fb196-67f9-42fa-b592-49eeb3b84346",
 shopDomain:"azymhc-x0.myshopify.com",
 shopGid:"gid://shopify/Shop/100002726208",
 clientId:"1ed12710f0b797a7a3328c1cf4e8b1f9"
});
const UNVERIFIED=Object.freeze({matched:false,reason:"shop-identity-unverified"});
const CONFLICT=Object.freeze({matched:false,reason:"shop-identity-conflict"});
const MATCHED=Object.freeze({matched:true,reason:"shop-identity-matched"});

/**
 * Both observations are required for every protected RPC, with no positive
 * caching. An absent Supabase app Client ID/shop GID, wrong tenant or a
 * different canonical .myshopify.com hostname must deny authorization.
 * No credential, provider data, or exception detail is ever returned.
 */
export async function assessGatehouseShopIdentity({
 readShopifyIdentity,readProviderIdentity
}={}){
 if(typeof readShopifyIdentity!=="function"||
    typeof readProviderIdentity!=="function")return UNVERIFIED;
 let shop,provider;
 try{
  [shop,provider]=await Promise.all([
   readShopifyIdentity(),readProviderIdentity()
  ]);
 }catch{return UNVERIFIED;}
 if(!shop||typeof shop!=="object"||Array.isArray(shop)||
    !provider||typeof provider!=="object"||Array.isArray(provider))
  return UNVERIFIED;
 if(shop.id!==PINNED.shopGid||
    shop.myshopifyDomain!==PINNED.shopDomain||
    provider.organizationId!==PINNED.organizationId||
    provider.shopGid!==PINNED.shopGid||
    provider.shopDomain!==PINNED.shopDomain||
    provider.clientId!==PINNED.clientId)
  return CONFLICT;
 return MATCHED;
}
