export const SHOPIFY_READ_QUERY = `query MarketingMachineSnapshot {
  shop { name currencyCode }
  products(first: 25) { nodes { id title status totalInventory variants(first: 10) { nodes { id title price inventoryQuantity } } } }
}`;

export async function readShopifySnapshot(fetchImpl=globalThis.fetch){
  if(typeof fetchImpl!=="function") throw new Error("shopify_fetch_unavailable");
  const res=await fetchImpl("shopify:admin/api/graphql.json",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:SHOPIFY_READ_QUERY})});
  if(!res.ok) throw new Error("shopify_read_failed");
  const body=await res.json();
  if(body.errors?.length) throw new Error("shopify_graphql_error");
  return body.data;
}

export function requireApprovedMutation({approved=false,killSwitch=true}={}){
  if(killSwitch) return {allow:false,reason:"kill_switch_armed"};
  if(!approved) return {allow:false,reason:"approval_required"};
  return {allow:true,reason:"approved"};
}
