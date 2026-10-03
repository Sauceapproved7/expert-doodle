import test from "node:test";
import assert from "node:assert/strict";
import { buildCreateSessionTx, buildTransitionTx, buildPinTx } from "../shopify/hercules/live-commerce/postgres-persistence.mjs";

test("session creation persists commerce disabled with audit record",()=>{
 const tx=buildCreateSessionTx({id:"live-10",shopDomain:"sauceapproved-2.myshopify.com",title:"Drop",actorId:"owner"});
 assert.equal(tx.statements.length,2);
 assert.match(tx.statements[0].text,/commerce_enabled/);
 assert.equal(tx.statements[0].values.includes(false),true);
 assert.match(tx.statements[1].text,/live_commerce_audit/);
});

test("transition update is optimistic and cannot enable commerce",()=>{
 const tx=buildTransitionTx({id:"live-10",from:"scheduled",to:"prelive",expectedVersion:4,actorId:"owner"});
 assert.match(tx.statements[0].text,/version = \$4/);
 assert.match(tx.statements[0].text,/commerce_enabled = false/);
 assert.match(tx.statements[0].text,/version = \$5/);
 assert.deepEqual(tx.statements[0].values,["live-10","scheduled","prelive",4,4]);
});

test("pin update requires Shopify variant GID and expected version",()=>{
 assert.throws(()=>buildPinTx({id:"live-10",variantGid:"123",expectedVersion:2,actorId:"owner"}),/invalid_shopify_variant_gid/);
 const tx=buildPinTx({id:"live-10",variantGid:"gid://shopify/ProductVariant/123",expectedVersion:2,actorId:"owner",durationSeconds:300});
 assert.match(tx.statements[0].text,/pinned_variant_gid/);
 assert.match(tx.statements[0].text,/version = \$4/);
 assert.equal(tx.statements[0].values[1],"gid://shopify/ProductVariant/123");
});
