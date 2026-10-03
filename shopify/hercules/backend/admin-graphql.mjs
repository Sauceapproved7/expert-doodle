function normalizeShop(shop) {
  const value = String(shop || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) throw new Error("invalid_shop_domain");
  return value;
}

function normalizeVersion(version) {
  const value = String(version || "").trim();
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("api_version_required");
  return value;
}

export function buildAdminGraphqlEndpoint(shop, apiVersion) {
  return `https://${normalizeShop(shop)}/admin/api/${normalizeVersion(apiVersion)}/graphql.json`;
}


function required(value,name){const v=String(value??"").trim();if(!v)throw new Error(name+"_required");return v;}

export function buildAdminGraphqlRequest({shop,apiVersion,accessToken,query,variables={}}={}){
  const token=required(accessToken,"access_token"),document=required(query,"query");
  return {url:buildAdminGraphqlEndpoint(shop,apiVersion),method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","X-Shopify-Access-Token":token},body:JSON.stringify({query:document,variables})};
}

export function buildProductListQuery({first=20,searchQuery=null,after=null}={}){
  const count=Number(first); if(!Number.isInteger(count)||count<1||count>250)throw new Error("invalid_product_page_size");
  return {query:`query GetProducts($first: Int!, $query: String, $after: String) { products(first: $first, query: $query, after: $after) { nodes { id title handle status vendor productType totalInventory updatedAt variants(first: 10) { nodes { id title sku price inventoryQuantity } } } pageInfo { hasNextPage endCursor } } }`,variables:{first:count,query:searchQuery,after}};
}

export function buildInventoryQuery({variantId}={}){
  const id=required(variantId,"variant_id"); if(!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id))throw new Error("invalid_shopify_variant_gid");
  return {query:`query VariantInventory($id: ID!) { productVariant(id: $id) { id title sku inventoryItem { id tracked inventoryLevels(first: 100) { nodes { id quantities(names: ["available","on_hand","committed"]) { name quantity } location { id name isActive } } } } } }`,variables:{id}};
}

export function buildMutationPreview({operation,variables={}}={}){
  return {dryRun:true,blocked:true,operation:required(operation,"operation"),variables,reason:"write_scope_not_authorized"};
}


function assertReadOnlyDocument(query){
  const document=String(query??"").replace(/#[^\n]*/g," ").trim();
  if(!document||/\bmutation\b/i.test(document))throw new Error("read_only_graphql_required");
}

export async function executeAdminGraphqlRead({shop,apiVersion,accessToken,query,variables={},fetchImpl=globalThis.fetch,sleep=(ms)=>new Promise(r=>setTimeout(r,ms)),maxRetries=3}={}){
  assertReadOnlyDocument(query);
  if(typeof fetchImpl!=="function")throw new Error("fetch_required");
  const retries=Number(maxRetries);if(!Number.isInteger(retries)||retries<1||retries>5)throw new Error("invalid_max_retries");
  const request=buildAdminGraphqlRequest({shop,apiVersion,accessToken,query,variables});
  for(let attempt=0;attempt<retries;attempt++){
    let response;
    try{response=await fetchImpl(request.url,{method:request.method,headers:request.headers,body:request.body});}
    catch(error){if(attempt+1>=retries)throw new Error("shopify_transport_failed",{cause:error});await sleep(Math.min(250*(2**attempt),2000));continue;}
    if(response.status===429||response.status>=500){if(attempt+1>=retries)throw new Error("shopify_http_"+response.status);await sleep(Math.min(250*(2**attempt),2000));continue;}
    if(!response.ok)throw new Error("shopify_http_"+response.status);
    let body;try{body=await response.json();}catch{throw new Error("invalid_shopify_json");}
    const errors=Array.isArray(body?.errors)?body.errors:[];
    const throttled=errors.some(e=>e?.extensions?.code==="THROTTLED");
    if(throttled&&attempt+1<retries){await sleep(Math.min(250*(2**attempt),2000));continue;}
    if(errors.length)throw new Error("shopify_graphql_error");
    if(body?.data==null)throw new Error("shopify_data_missing");
    return body.data;
  }
  throw new Error("shopify_retry_exhausted");
}
