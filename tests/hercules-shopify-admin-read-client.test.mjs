import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminGraphqlRequest, buildProductListQuery, buildInventoryQuery, buildMutationPreview } from "../shopify/hercules/backend/admin-graphql.mjs";

test("Admin GraphQL request keeps token server-side in the Shopify header",()=>{
 const req=buildAdminGraphqlRequest({shop:"sauceapproved-2.myshopify.com",apiVersion:"2026-10",accessToken:"secret-token",query:"query { shop { id } }"});
 assert.equal(req.url,"https://sauceapproved-2.myshopify.com/admin/api/2026-10/graphql.json");
 assert.equal(req.headers["X-Shopify-Access-Token"],"secret-token");
 assert.equal(req.body.includes("secret-token"),false);
});

test("product and inventory builders are read-only GraphQL queries",()=>{
 assert.match(buildProductListQuery({first:20}).query,/query GetProducts/);
 assert.match(buildInventoryQuery({variantId:"gid://shopify/ProductVariant/123"}).query,/query VariantInventory/);
 assert.throws(()=>buildInventoryQuery({variantId:"123"}),/invalid_shopify_variant_gid/);
});

test("mutation preview never returns an executable request",()=>{
 const preview=buildMutationPreview({operation:"productCreate",variables:{product:{title:"Draft"}}});
 assert.deepEqual(preview,{dryRun:true,blocked:true,operation:"productCreate",variables:{product:{title:"Draft"}},reason:"write_scope_not_authorized"});
});
