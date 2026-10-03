import { reconciliationWindow } from "./reconciliation.mjs";

export function buildReconciliationPlan({shopDomain,apiVersion,watermark,now=new Date(),dryRun=true}={}){
  const shop=String(shopDomain||"").trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))throw new Error("invalid_shop_domain");
  const version=String(apiVersion||"").trim();
  if(!/^\d{4}-\d{2}$/.test(version))throw new Error("api_version_required");
  const {start,end}=reconciliationWindow({watermark:new Date(watermark),now:new Date(now),overlapMs:5*60*1000});
  return {shopDomain:shop,apiVersion:version,dryRun:dryRun!==false,advanceWatermark:false,window:{start:start.toISOString(),end:end.toISOString()}};
}

export async function runReconciler(){
  const shopDomain=process.env.SHOPIFY_SHOP_DOMAIN;
  const apiVersion=process.env.SHOPIFY_API_VERSION;
  const watermark=process.env.SHOPIFY_RECONCILIATION_WATERMARK||new Date().toISOString();
  const plan=buildReconciliationPlan({shopDomain,apiVersion,watermark,dryRun:true});
  process.stdout.write(JSON.stringify(plan)+"\n");
  return plan;
}

if(import.meta.url===new URL("file://"+process.argv[1]).href)runReconciler().catch((error)=>{console.error(error.message);process.exitCode=1;});
