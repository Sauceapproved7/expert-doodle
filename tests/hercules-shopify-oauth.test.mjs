import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { REQUIRED_SCOPES, buildAuthorizationUrl, verifyOAuthCallback, validateGrantedScopes } from "../shopify/hercules/backend/oauth.mjs";

test("OAuth requests only current read-only Hercules scopes",()=>{
 assert.deepEqual(REQUIRED_SCOPES,["read_inventory","read_locations","read_orders","read_products"]);
 const url=new URL(buildAuthorizationUrl({shop:"sauceapproved-2.myshopify.com",clientId:"client",redirectUri:"https://app.example/auth/callback",state:"nonce"}));
 assert.equal(url.searchParams.get("scope"),REQUIRED_SCOPES.join(","));
 assert.equal(url.searchParams.get("state"),"nonce");
});

test("OAuth callback verifies state and Shopify HMAC",()=>{
 const secret="oauth-secret";
 const query={code:"abc",shop:"sauceapproved-2.myshopify.com",state:"nonce",timestamp:"1791020000"};
 const message=Object.entries(query).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("&");
 query.hmac=crypto.createHmac("sha256",secret).update(message).digest("hex");
 assert.equal(verifyOAuthCallback({query,expectedState:"nonce",secret}).shop,"sauceapproved-2.myshopify.com");
 assert.throws(()=>verifyOAuthCallback({query:{...query,state:"wrong"},expectedState:"nonce",secret}),/oauth_state_mismatch/);
});

test("granted scopes fail closed when required scope is absent",()=>{
 assert.deepEqual(validateGrantedScopes("read_products,read_orders,read_inventory,read_locations"),REQUIRED_SCOPES);
 assert.throws(()=>validateGrantedScopes("read_products,read_orders"),/missing_required_scope/);
});
