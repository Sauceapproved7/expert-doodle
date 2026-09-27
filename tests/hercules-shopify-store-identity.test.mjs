import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const raw=await readFile(new URL("../governance/shopify-production-store.json",import.meta.url),"utf8");
const x=JSON.parse(raw);

test("production Shopify identity is locked to one Shop GID",()=>{
  assert.equal(x.schema,"sauceapproved.shopify.production-store.v1");
  assert.equal(x.status,"active");
  assert.equal(x.shop.gid,"gid://shopify/Shop/100002726208");
  assert.equal(x.identityRule.aliasesRepresentSameShop,true);
  assert.equal(x.identityRule.neverTreatOriginalAndCurrentPrimaryAsSeparateStores,true);
});

test("both Shopify domains are recorded as one shop identity",()=>{
  assert.equal(x.shop.originalMyshopifyDomain,"azymhc-x0.myshopify.com");
  assert.equal(x.shop.currentPrimaryDomain,"sauceapproved-2.myshopify.com");
  assert.equal(x.shop.currentPrimarySslEnabled,true);
});

test("production anchor product matches the expected hoodie",()=>{
  assert.equal(x.anchorProduct.gid,"gid://shopify/Product/10258238406976");
  assert.equal(x.anchorProduct.status,"ACTIVE");
  assert.equal(x.anchorProduct.vendor,"Printify");
  assert.equal(x.anchorProduct.variantsCount,29);
});

test("custom-domain promotion remains health gated",()=>{
  assert.equal(x.intendedCustomDomain,"sauceapproved.com");
  assert.equal(x.cutoverPolicy.requireRegistrarDnsReady,true);
  assert.equal(x.cutoverPolicy.requireShopifyCustomDomainRecognized,true);
  assert.equal(x.cutoverPolicy.requireCustomDomainSslEnabled,true);
  assert.equal(x.cutoverPolicy.makeCustomDomainPrimaryOnlyAfterAllChecksPass,true);
});
