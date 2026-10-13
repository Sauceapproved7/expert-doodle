/** Hercules Gatehouse commercial preparation. No network writes or sales authority. */
import {createHmac,timingSafeEqual} from "node:crypto";
import {isIP} from "node:net";

const diagnostic=Object.freeze({
 id:"gatehouse-diagnostic-49",title:"Hercules Gatehouse — Website Health Diagnostic",
 sku:"HG-DIAGNOSTIC-49",priceCents:4900,currency:"USD",billing:"one_time",
 shopifyProductId:"gid://shopify/Product/15424049283392",
 shopifyVariantId:"gid://shopify/ProductVariant/67754351460672",
 status:"draft",purchaseEnabled:false,reportDeliveryEnabled:false
});
const subscriptions=[
 {name:"Starter",priceCents:1900,siteLimit:3},
 {name:"Pro",priceCents:4900,siteLimit:15},
 {name:"Business",priceCents:14900,siteLimit:50}
].map(p=>Object.freeze({...p,currency:"USD",interval:"month",status:"proposal",
 purchaseEnabled:false,recurringConfigured:false,serverMonitoringVerified:false}));
export const CATALOG=Object.freeze({
 business:"SauceApproved enterprise LLC",status:"prelaunch-no-charge",
 diagnostic,subscriptions:Object.freeze(subscriptions),
 notice:"No checkout, subscription, financial account, order delivery, or new launch permission is connected to this preview."
});

const PUBLIC_NAMES=new Set(["Hercules MCP","Studio","Smallz","Domain Guard"]);
const RESULTS=new Set(["reachable","unreachable"]);
export function normalizeIntake({website,authorized}={}){
 if(authorized!==true)throw new TypeError("Website owner/operator authorization is required");
 if(typeof website!=="string"||website.length>256||!website.startsWith("https://"))throw new TypeError("HTTPS origin required");
 let url;
 try{url=new URL(website)}catch{throw new TypeError("Invalid origin")}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/"
    ||url.port||!url.hostname.includes(".")||isIP(url.hostname)
    ||/(^|\.)(localhost|local|internal|test|invalid|onion)$/i.test(url.hostname)
    ||!/^[a-z0-9.-]+$/i.test(url.hostname)
    ||url.hostname.split(".").some(x=>!x||x.length>63||x.startsWith("-")||x.endsWith("-")))
  throw new TypeError("Only public HTTPS domain origins without credentials or paths are accepted");
 return {website:url.origin,authorization:"customer-self-attested-not-verified",
  state:"draft-only",collectionEnabled:false};
}
export function buildDemoReport(summary={}){
 const timestamp=Date.parse(summary.refreshedAt);
 const observations=(Array.isArray(summary.signals)?summary.signals:[])
  .filter(x=>PUBLIC_NAMES.has(x?.name)&&RESULTS.has(x?.status))
  .map(x=>({name:x.name,status:x.status}));
 return {
  schema:"hercules.gatehouse.diagnostic-demo.v1",
  kind:"sample-platform-report-not-customer-deliverable",
  subject:"Hercules public endpoint sample (not customer website)",
  observedAt:Number.isFinite(timestamp)?new Date(timestamp).toISOString():null,
  observations,customerWebsiteProbed:false,verifiedPaidOrder:false,deliveryAuthorized:false,
  providerAttested:false,productionAuthorized:false,moneyMovedByGatehouse:false,
  diagnosticScope:"Read-only public endpoint reachability of predefined Hercules services; no customer domain was scanned.",
  limitations:"This is an example report only. It does not certify uptime, checkout, payouts, web security, client identity, or successful delivery."
 };
}
const reject=()=>({status:"unverified",hmacVerified:false,deliveryAuthorized:false,moneyMovedByGatehouse:false});
export function assessPaidOrderWebhook({rawBody,hmac,webhookSecret,shopDomain,expectedShopDomain}={}){
 if(typeof webhookSecret!=="string"||webhookSecret.length<16 ||
   (typeof rawBody!=="string"&&!Buffer.isBuffer(rawBody))||Buffer.byteLength(rawBody)>256000||
   !Buffer.byteLength(rawBody)||typeof hmac!=="string"||typeof shopDomain!=="string"||
   shopDomain!==expectedShopDomain||!expectedShopDomain) return reject();
 const expected=createHmac("sha256",webhookSecret).update(rawBody).digest();
 let received;
 try{received=Buffer.from(hmac,"base64")}catch{return reject()}
 if(received.length!==expected.length||!timingSafeEqual(received,expected))return reject();
 let order;
 try{order=JSON.parse(rawBody)}catch{return reject()}
 const lines=order?.line_items;
 const one=Array.isArray(lines)&&lines.length===1&&lines[0];
 if(!one||order.financial_status!=="paid"||order.currency!=="USD"||
  order.total_price!=="49.00"||order.cancelled_at!==null||
  !Array.isArray(order.refunds)||order.refunds.length!==0||
  String(one.variant_id)!=="67754351460672"||one.sku!==diagnostic.sku||
  one.quantity!==1||one.price!=="49.00"||!Number.isSafeInteger(Number(order.id))||
  Number(order.id)<=0)return reject();
 return {status:"needs-provider-readback",hmacVerified:true,orderReference:String(order.id),
   deliveryAuthorized:false,moneyMovedByGatehouse:false,
   notice:"A signed matching event is not final proof of payment settlement, customer authorization, refund state, or authenticated report delivery. Independently re-read provider order and entitlement before any fulfillment."};
}
/** This implementation deliberately never delivers or bills. */
export function canDeliverPaidReport(){return false}
