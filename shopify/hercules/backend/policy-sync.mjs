import {createHash} from 'node:crypto';

export const POLICY_TYPES=Object.freeze(['SHIPPING_POLICY','LEGAL_NOTICE','REFUND_POLICY','TERMS_OF_SERVICE']);
const PREFLIGHT=`query HerculesLegalPolicyPreflight { shop { myshopifyDomain shopPolicies { type body } } currentAppInstallation { accessScopes { handle } } }`;
const UPDATE=`mutation HerculesPolicyUpdate($shopPolicy:ShopPolicyInput!) { shopPolicyUpdate(shopPolicy:$shopPolicy) { shopPolicy { type body } userErrors { field message } } }`;
function fail(name){throw new Error(name);}
function domain(value){const s=String(value||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$/.test(s))fail('invalid_shop_domain');return s;}
function checkBody(value){if(typeof value!=='string'||value.trim().length<25||Buffer.byteLength(value,'utf8')>512*1024||/<p>\\s*yes\\s*<\\/p>/i.test(value)||/\\[(?:INSERT|LINK|TODO)[^\\]]*\\]|\\b(?:DRAFT|NOT APPROVED|PLACEHOLDER)\\b/i.test(value))fail('policy_placeholder');return value;}
function sha(value){return createHash('sha256').update(value,'utf8').digest('hex');}

export function planApprovedPolicySync({shopDomain,expectedShopDomain,grantedScopes,existingPolicies,approvedPolicies,approvalHashes,ownerApproved=false}={}){
 if(ownerApproved!==true)fail('owner_policy_approval_required');
 if(domain(shopDomain)!==domain(expectedShopDomain))fail('shop_domain_mismatch');
 const scopes=new Set(Array.isArray(grantedScopes)?grantedScopes:[]);
 if(!scopes.has('read_legal_policies'))fail('missing_legal_read_scope');
 if(!scopes.has('write_legal_policies'))fail('missing_legal_write_scope');
 if(!approvedPolicies||typeof approvedPolicies!=='object'||Array.isArray(approvedPolicies)||!approvalHashes||typeof approvalHashes!=='object')fail('approved_policies_required');
 const keys=Object.keys(approvedPolicies);
 if(keys.length!==POLICY_TYPES.length||keys.some(k=>!POLICY_TYPES.includes(k)))fail('policy_type_not_allowed');
 if(!Array.isArray(existingPolicies))fail('existing_policies_required');
 const originals=new Map();for(const p of existingPolicies){if(originals.has(p?.type))fail('duplicate_existing_policy'); originals.set(p?.type,p?.body);}
 const updates=[];
 for(const type of POLICY_TYPES){
  if(!Object.hasOwn(approvedPolicies,type)||!originals.has(type))fail('policy_missing:'+type);
  const body=checkBody(approvedPolicies[type]);
  if(sha(body)!==approvalHashes[type])fail('approval_hash_mismatch');
  if(originals.get(type)!==body)updates.push({type,body});
 }
 return {shop:domain(shopDomain),updates};
}

async function graphql({shop,apiVersion,accessToken,query,variables={},fetchImpl}){
 if(typeof fetchImpl!=='function')fail('fetch_required');
 if(!/^\\d{4}-\\d{2}$/.test(String(apiVersion||'')))fail('invalid_api_version');
 if(typeof accessToken!=='string'||accessToken.length<5)fail('access_token_required');
 const endpoint=`https://${domain(shop)}/admin/api/${apiVersion}/graphql.json`;
 const res=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':accessToken},body:JSON.stringify({query,variables})});
 if(!res?.ok)fail('shopify_http_'+(res?.status||'error'));
 const json=await res.json();
 if(json?.errors?.length)fail('shopify_graphql_error');
 if(!json?.data)fail('shopify_missing_data');
 return json.data;
}

export async function publishApprovedPolicies({shop,expectedShopDomain,apiVersion,accessToken,approvedPolicies,approvalHashes,ownerApproved=false,fetchImpl=globalThis.fetch}={}){
 // The caller must independently authenticate the owner and verify approval of exact policy bytes.
 // This helper does not grant authority; a provider-issued scoped token is still mandatory.
 if(ownerApproved!==true)fail('owner_policy_approval_required');
 const read=()=>graphql({shop,apiVersion,accessToken,query:PREFLIGHT,fetchImpl});
 const initial=await read();
 const plan=planApprovedPolicySync({shopDomain:initial.shop?.myshopifyDomain,expectedShopDomain,grantedScopes:initial.currentAppInstallation?.accessScopes?.map(x=>x.handle),existingPolicies:initial.shop?.shopPolicies,approvedPolicies,approvalHashes,ownerApproved});
 if(plan.shop!==domain(shop))fail('shop_domain_mismatch');
 const updated=[];
 for(const policy of plan.updates){
  const res=await graphql({shop,apiVersion,accessToken,query:UPDATE,variables:{shopPolicy:policy},fetchImpl});
  const result=res?.shopPolicyUpdate;
  if(result?.userErrors?.length||result?.shopPolicy?.type!==policy.type||result?.shopPolicy?.body!==policy.body)fail('policy_update_unverified:'+policy.type);
  updated.push(policy.type);
 }
 const verified=await read();
 if(domain(verified.shop?.myshopifyDomain)!==plan.shop)fail('shop_domain_mismatch');
 for(const type of POLICY_TYPES){
  const current=verified.shop?.shopPolicies?.find(p=>p.type===type)?.body;
  if(current!==approvedPolicies[type])fail('policy_readback_mismatch:'+type);
 }
 return {shop:plan.shop,updated,verified:true};
}
