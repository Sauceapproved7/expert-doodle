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
