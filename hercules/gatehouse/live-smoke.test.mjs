import test from "node:test";
import assert from "node:assert/strict";
import {runGatehousePublicSmoke, GATEHOUSE_SMOKE_ORIGIN} from "./live-smoke.mjs";

const health={service:"hercules-gatehouse",status:"running",
 mode:"isolated-read-only",productionAuthorized:false};
const portal={status:"preview-only",checkoutEnabled:false,registrationOpen:false,
 customerDataCollectionEnabled:false,reportDeliveryEnabled:false};
const auth={customerSignupEnabled:false,checkoutEnabled:false,reportDeliveryEnabled:false};
const json=(body,status=200)=>({status,headers:{get:()=> "application/json"},
 json:async()=>body});
function harness(overrides={}){
 const seen=[];
 const fetcher=async(url,opts)=>{
  seen.push({url,opts});
  const p=new URL(url).pathname;
  if(p==="/health")return json(overrides.health??health);
  if(p==="/api/customer/portal-readiness")return json(overrides.portal??portal);
  if(p==="/api/customer/auth/capability")return json(overrides.auth??auth);
  if(p==="/api/private/shopify-order-readback")return json({},overrides.orderStatus??401);
  if(p==="/api/customer/reports")return json({},overrides.reportStatus??503);
  throw Error("unexpected path");
 };
 return {fetcher,seen};
}
test("GET-only smoke proves public response and anonymous-private HOLD without unlocking checkout",async()=>{
 const h=harness();
 const result=await runGatehousePublicSmoke({fetcher:h.fetcher});
 assert.deepEqual(result,{status:"verified-readonly-http-contract",checks:5,
  checkoutEnabled:false,reportDeliveryEnabled:false,providerOrderReadVerified:false});
 assert.equal(h.seen.length,5);
 for(const request of h.seen){
  assert.ok(request.url.startsWith(GATEHOUSE_SMOKE_ORIGIN+"/"));
  assert.equal(request.opts.method,"GET");
  assert.equal(request.opts.redirect,"error");
  assert.ok(request.opts.signal);
  assert.equal(request.opts.headers.accept,"application/json");
  assert.equal(request.opts.headers.authorization,undefined);
  assert.equal(request.opts.headers.cookie,undefined);
  assert.equal(request.opts.body,undefined);
 }
});
test("a public launch-enabled response fails instead of reporting ready",async()=>{
 for(const bad of [
  {health:{...health,productionAuthorized:true}},
  {portal:{...portal,checkoutEnabled:true}},
  {portal:{...portal,registrationOpen:true}},
  {portal:{...portal,reportDeliveryEnabled:true}},
  {auth:{...auth,customerSignupEnabled:true}},
  {auth:{...auth,checkoutEnabled:true}}
 ]){
  const h=harness(bad);
  await assert.rejects(()=>runGatehousePublicSmoke({fetcher:h.fetcher}),/public-smoke-failed/);
 }
});
test("anonymous private order and report endpoints must not return HTTP 200",async()=>{
 for(const bad of [{orderStatus:200},{reportStatus:200},{orderStatus:302}]){
  const h=harness(bad);
  await assert.rejects(()=>runGatehousePublicSmoke({fetcher:h.fetcher}),/public-smoke-failed/);
 }
});
test("network errors, HTTP body errors and wrong public service identity fail closed",async()=>{
 await assert.rejects(()=>runGatehousePublicSmoke({fetcher:async()=>{throw Error("PRIVATE_TOKEN")}}),/public-smoke-failed/);
 const h=harness({health:{...health,service:"other"}});
 await assert.rejects(()=>runGatehousePublicSmoke({fetcher:h.fetcher}),/public-smoke-failed/);
});
