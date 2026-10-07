import test from "node:test";
import assert from "node:assert/strict";
import {SupabaseManagementOAuthClient} from "../hercules-deploy/supabase-management-oauth.mjs";

const clientId="hercules-client";
const clientSecret=["synthetic","oauth","fixture"].join("-");
const redirectUri="https://hercules-mcp.onrender.com/oauth/supabase-management/callback";

test("management OAuth bridge builds PKCE authorization without putting secrets in the URL", async()=>{
  const c=new SupabaseManagementOAuthClient({clientId,clientSecret,redirectUri,fetchImpl:async()=>{throw new Error("network");}});
  const started=await c.beginAuthorization({state:"state-123",codeVerifier:"v".repeat(64),organizationSlug:"sauceapproved"});
  const u=new URL(started.authorizationUrl);
  assert.equal(u.origin,"https://api.supabase.com");
  assert.equal(u.pathname,"/v1/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"),clientId);
  assert.equal(u.searchParams.get("response_type"),"code");
  assert.equal(u.searchParams.get("redirect_uri"),redirectUri);
  assert.equal(u.searchParams.get("state"),"state-123");
  assert.equal(u.searchParams.get("code_challenge_method"),"S256");
  assert.ok(u.searchParams.get("code_challenge"));
  assert.equal(u.search.includes(clientSecret),false);
});

test("management OAuth bridge exchanges a code and refreshes without leaking credentials into URLs", async()=>{
  const calls=[];
  const c=new SupabaseManagementOAuthClient({clientId,clientSecret,redirectUri,fetchImpl:async(url,options={})=>{
    calls.push({url:String(url),options});
    return Response.json({access_token:"access-token-value",refresh_token:"refresh-token-value",expires_in:3600,token_type:"Bearer"});
  }});
  const exchanged=await c.exchangeCode({code:"code-123",codeVerifier:"v".repeat(64)});
  assert.equal(exchanged.accessToken,"access-token-value");
  await c.refresh({refreshToken:"refresh-token-value"});
  assert.equal(calls.length,2);
  for(const call of calls){
    assert.equal(call.url,"https://api.supabase.com/v1/oauth/token");
    assert.equal(call.url.includes(clientSecret),false);
    assert.equal(call.options.method,"POST");
    assert.match(call.options.headers.authorization,/^Basic /);
    assert.equal(call.options.headers["content-type"],"application/x-www-form-urlencoded");
  }
  assert.equal(new URLSearchParams(calls[0].options.body).get("grant_type"),"authorization_code");
  assert.equal(new URLSearchParams(calls[1].options.body).get("grant_type"),"refresh_token");
});

test("management OAuth bridge fails closed on unsafe redirect URIs and missing state", async()=>{
  assert.throws(()=>new SupabaseManagementOAuthClient({clientId,clientSecret,redirectUri:"http://example.com/callback"}),/HTTPS/);
  const c=new SupabaseManagementOAuthClient({clientId,clientSecret,redirectUri});
  await assert.rejects(c.beginAuthorization({state:"",codeVerifier:"v".repeat(64)}),/state/);
});
