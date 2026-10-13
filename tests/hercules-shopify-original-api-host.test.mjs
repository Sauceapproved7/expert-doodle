import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const code=await readFile(new URL("../supabase/functions/hercules-provider-connect/index.ts",import.meta.url),"utf8");
test("Shopify OAuth uses the live attested original myshopify API hostname, never account alias",()=>{
 assert.match(code,/const STORE='sauceapproved-2\.myshopify\.com';/);
 assert.match(code,/const SHOPIFY_API_HOST='azymhc-x0\.myshopify\.com';/);
 assert.match(code,/fetch\(`https:\/\/\$\{SHOPIFY_API_HOST\}\/admin\/oauth\/access_token`/);
 assert.doesNotMatch(code,/fetch\(`https:\/\/\$\{STORE\}\/admin\/oauth\/access_token`/);
});
test("Admin GraphQL also connects directly to verified shop API host without cross-host redirects",()=>{
 assert.match(code,/fetch\(`https:\/\/\$\{SHOPIFY_API_HOST\}\/admin\/api\/2026-07\/graphql\.json`/);
 assert.doesNotMatch(code,/fetch\(`https:\/\/\$\{STORE\}\/admin\/api\/2026-07\/graphql\.json`/);
 assert.match(code,/const SHOP_GID='gid:\/\/shopify\/Shop\/100002726208';/);
 assert.match(code,/shopDomainAllowed\(app\.shop\.myshopifyDomain\)/);
});
test("Fixed target rejects redirects and leaves original provider account-key schema intact",()=>{
 const oauth=code.slice(code.indexOf("async function exchangeShopifyToken"),code.indexOf("async function stripeRequest"));
 assert.match(oauth,/redirect:'error'/);
 const gql=code.slice(code.indexOf("async function shopifyGraphql"),code.indexOf("async function exchangeShopifyToken"));
 assert.match(gql,/redirect:'error'/);
 assert.match(code,/upsertConnection\(admin,org,'shopify',STORE,/);
 assert.match(code,/client_id:clientId/);
 assert.match(code,/secret_ref:secretRef/);
});
