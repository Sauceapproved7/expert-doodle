import test from "node:test";
import assert from "node:assert/strict";
import {CATALOG,normalizeIntake,buildDemoReport,assessPaidOrderWebhook,canDeliverPaidReport} from "./commerce.mjs";
import {createHmac} from "node:crypto";

test("price catalog is proposed or draft only and cannot initiate a charge",()=>{
 assert.equal(CATALOG.diagnostic.priceCents,4900);
 assert.equal(CATALOG.diagnostic.shopifyProductId,"gid://shopify/Product/15424049283392");
 assert.equal(CATALOG.diagnostic.purchaseEnabled,false);
 assert.equal(CATALOG.subscriptions.length,3);
 assert.deepEqual(CATALOG.subscriptions.map(p=>p.priceCents),[1900,4900,14900]);
 assert.ok(CATALOG.subscriptions.every(p=>p.purchaseEnabled===false&&p.recurringConfigured===false));
});
test("customer request requires authorization and accepts only normalized HTTPS origins",()=>{
 assert.deepEqual(normalizeIntake({website:"https://example.com",authorized:true}),{
  website:"https://example.com",authorization:"customer-self-attested-not-verified",state:"draft-only",collectionEnabled:false
 });
 for(const url of ["http://example.com","https://127.0.0.1","https://localhost","https://foo.local","https://user:pass@example.com","https://example.com:8080","https://example.com/private","https://example.com?q=secret","https://[::1]","https://example.com/#section","not a URL"]){
  assert.throws(()=>normalizeIntake({website:url,authorized:true}),undefined,url);
 }
 assert.throws(()=>normalizeIntake({website:"https://example.com",authorized:false}));
});
test("demo report only describes actual observed Hercules endpoints and never claims a customer scan",()=>{
 const r=buildDemoReport({refreshedAt:"2026-10-13T12:00:00.000Z",signals:[{name:"Studio",status:"reachable",headers:{token:"SECRET"}},{name:"Stripe",status:"reachable"},{name:"Smallz",status:"unreachable"}]});
 assert.equal(r.schema,"hercules.gatehouse.diagnostic-demo.v1");
 assert.equal(r.kind,"sample-platform-report-not-customer-deliverable");
 assert.equal(r.verifiedPaidOrder,false);
 assert.equal(r.deliveryAuthorized,false);
 assert.equal(r.customerWebsiteProbed,false);
 assert.deepEqual(r.observations.map(x=>x.name),["Studio","Smallz"]);
 assert.ok(!JSON.stringify(r).includes("SECRET"));
});
test("signed paid webhook with correct SKU is still a recheck candidate, never automatic fulfillment",()=>{
 const body=JSON.stringify({id:1234,financial_status:"paid",currency:"USD",total_price:"49.00",cancelled_at:null,refunds:[],line_items:[{sku:"HG-DIAGNOSTIC-49",variant_id:67754351460672,quantity:1,price:"49.00"}]});
 const secret="t".repeat(36),sig=createHmac("sha256",secret).update(body).digest("base64");
 const r=assessPaidOrderWebhook({rawBody:body,hmac:sig,webhookSecret:secret,shopDomain:"sauceapproved-2.myshopify.com",expectedShopDomain:"sauceapproved-2.myshopify.com"});
 assert.equal(r.hmacVerified,true);
 assert.equal(r.status,"needs-provider-readback");
 assert.equal(r.deliveryAuthorized,false);
 assert.equal(r.moneyMovedByGatehouse,false);
 assert.equal(r.orderReference,"1234");
 assert.equal(JSON.stringify(r).includes("secret"),false);
});
test("bad signature, unpaid, refunded, canceled and wrong products fail closed",()=>{
 const secret="t".repeat(36);
 const base={id:1234,financial_status:"paid",currency:"USD",total_price:"49.00",cancelled_at:null,refunds:[],line_items:[{sku:"HG-DIAGNOSTIC-49",variant_id:67754351460672,quantity:1,price:"49.00"}]};
 function run(x,withValidSignature=true){
  const rawBody=JSON.stringify(x),hmac=withValidSignature?createHmac("sha256",secret).update(rawBody).digest("base64"):"bogus";
  return assessPaidOrderWebhook({rawBody,hmac,webhookSecret:secret,shopDomain:"sauceapproved-2.myshopify.com",expectedShopDomain:"sauceapproved-2.myshopify.com"});
 }
 assert.equal(run(base,false).status,"unverified");
 for(const x of [{financial_status:"pending"},{refunds:[{id:1}]},{cancelled_at:"2026-10-13"},{total_price:"1.00"},{currency:"EUR"},{line_items:[{sku:"OTHER",variant_id:67754351460672,quantity:1,price:"49.00"}]},{line_items:[{sku:"HG-DIAGNOSTIC-49",variant_id:1,quantity:1,price:"49.00"}]},{line_items:[{sku:"HG-DIAGNOSTIC-49",variant_id:67754351460672,quantity:2,price:"49.00"}]}]){
  assert.equal(run({...base,...x}).status,"unverified");
 }
});
test("no client claims, test receipts, or webhook signals can authorize delivery",()=>{
 assert.equal(canDeliverPaidReport({providerRechecked:true,customerAuthorized:true,reportGenerated:true,identityVerified:true}),false);
 assert.equal(canDeliverPaidReport({providerRechecked:false,customerAuthorized:true,reportGenerated:true}),false);
});

test("missing webhook scope, malformed payloads and mixed carts never unlock access",()=>{
 const secret="t".repeat(36);
 const body=JSON.stringify({id:404,financial_status:"paid",currency:"USD",total_price:"49.00",cancelled_at:null,refunds:[],
  line_items:[{sku:"HG-DIAGNOSTIC-49",variant_id:67754351460672,quantity:1,price:"49.00"},{sku:"EXTRA",variant_id:55,quantity:1,price:"0.00"}]});
 const hmac=createHmac("sha256",secret).update(body).digest("base64");
 const args={rawBody:body,hmac,webhookSecret:secret,shopDomain:"sauceapproved-2.myshopify.com",expectedShopDomain:"sauceapproved-2.myshopify.com"};
 assert.equal(assessPaidOrderWebhook(args).status,"unverified");
 assert.equal(assessPaidOrderWebhook({...args,shopDomain:"other.myshopify.com"}).status,"unverified");
 assert.equal(assessPaidOrderWebhook({...args,webhookSecret:""}).status,"unverified");
 assert.equal(assessPaidOrderWebhook({...args,rawBody:"not JSON"}).status,"unverified");
});
