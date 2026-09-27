import test from "node:test";
import assert from "node:assert/strict";
import {analyzeDomainLaunch,SHOPIFY_TARGET} from "../supabase/functions/hercules-domains/domain-launch.mjs";

test("reports current parking-style DNS as not ready",()=>{
  const status=analyzeDomainLaunch({
    a:["34.216.117.25","54.149.79.189"],
    aaaa:[],
    cname:[],
    ns:["launch1.spaceship.net","launch2.spaceship.net"],
    credentialStatus:"unconfigured",
    primaryTargetId:"azymhc-x0.myshopify.com",
  });
  assert.equal(status.readiness.dnsReady,false);
  assert.equal(status.readiness.registrarReady,false);
  assert.ok(status.blockers.includes("spaceship_credentials_unconfigured"));
  assert.ok(status.blockers.includes("apex_a_not_shopify"));
});

test("exact Shopify records are ready for verification",()=>{
  const status=analyzeDomainLaunch({
    a:[SHOPIFY_TARGET.apexA],
    aaaa:[SHOPIFY_TARGET.apexAAAA],
    cname:["shops.myshopify.com."],
    credentialStatus:"configured",
    primaryTargetId:"azymhc-x0.myshopify.com",
  });
  assert.equal(status.readiness.dnsReady,true);
  assert.equal(status.readiness.readyForShopifyVerification,true);
  assert.deepEqual(status.blockers,[]);
});

test("extra apex A fails closed",()=>{
  const status=analyzeDomainLaunch({
    a:[SHOPIFY_TARGET.apexA,"192.0.2.10"],
    aaaa:[SHOPIFY_TARGET.apexAAAA],
    cname:[SHOPIFY_TARGET.wwwCname],
    credentialStatus:"configured",
    primaryTargetId:"azymhc-x0.myshopify.com",
  });
  assert.equal(status.readiness.dnsReady,false);
  assert.ok(status.blockers.includes("apex_a_not_shopify"));
});
