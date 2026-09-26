import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  verifyPassword,
  signJwtHs256,
  verifyJwtHs256,
  hashRefreshToken,
  createRefreshToken,
} from "../hercules-base/auth-core.mjs";

test("Hercules Base Auth hashes passwords with scrypt and never stores plaintext", async () => {
  const password="correct horse battery staple";
  const record=await hashPassword(password,{
    randomBytes:(size)=>Buffer.alloc(size,7),
  });

  assert.equal(record.algorithm,"scrypt");
  assert.notEqual(record.digest,password);
  assert.match(record.salt,/^[A-Za-z0-9_-]+$/);
  assert.equal(await verifyPassword(password,record),true);
  assert.equal(await verifyPassword(password+"x",record),false);
});

test("Hercules Base Auth issues and verifies bounded HS256 access tokens", () => {
  const secret="fixture-jwt-signing-key-that-is-long-enough";
  const token=signJwtHs256({
    sub:"11111111-1111-4111-8111-111111111111",
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
    nowSeconds:1000,
  },secret);

  assert.equal(token.split(".").length,3);
  const claims=verifyJwtHs256(token,secret,{
    issuer:"hercules-base",
    audience:"hercules-base-api",
    nowSeconds:1100,
  });
  assert.equal(claims.sub,"11111111-1111-4111-8111-111111111111");
  assert.equal(claims.role,"staging_user");
  assert.equal(claims.exp,1900);

  assert.throws(
    ()=>verifyJwtHs256(token,secret,{issuer:"wrong",audience:"hercules-base-api",nowSeconds:1100}),
    /issuer/i,
  );
  assert.throws(
    ()=>verifyJwtHs256(token,secret,{issuer:"hercules-base",audience:"hercules-base-api",nowSeconds:1901}),
    /expired/i,
  );
});

test("refresh tokens are opaque and only their hashes are persisted", () => {
  const token=createRefreshToken({randomBytes:(size)=>Buffer.alloc(size,9)});
  assert.match(token,/^[A-Za-z0-9_-]{40,}$/);
  const digest=hashRefreshToken(token);
  assert.match(digest,/^[a-f0-9]{64}$/);
  assert.equal(digest.includes(token),false);
});

test("auth migration creates private credential/session tables and server-only RPCs", async () => {
  const {readFile}=await import("node:fs/promises");
  const sql=await readFile(
    new URL("../staging-plane/migrations/002_base_auth.sql",import.meta.url),
    "utf8",
  );

  assert.match(sql,/create role staging_auth noinherit nologin/i);
  assert.match(sql,/grant staging_auth to hercules_api/i);
  assert.match(sql,/create table staging_api\.auth_users/i);
  assert.match(sql,/password_digest text not null/i);
  assert.match(sql,/password_salt text not null/i);
  assert.match(sql,/create table staging_api\.auth_sessions/i);
  assert.match(sql,/refresh_token_hash text not null unique/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on staging_api\.auth_users from public/i);
  assert.match(sql,/revoke all on staging_api\.auth_sessions from public/i);
  assert.match(sql,/grant execute on function staging_api\.auth_register/i);
  assert.match(sql,/grant execute on function staging_api\.auth_lookup/i);
  assert.match(sql,/grant execute on function staging_api\.auth_rotate_session/i);
  assert.match(sql,/grant execute on function staging_api\.auth_revoke_session/i);
});

test("Base Auth HTTP surface is bounded and does not expose password or refresh hashes", async () => {
  const {routeAuthRequest}=await import("../hercules-base/auth-router.mjs");

  const store={
    async register({email,passwordRecord}){
      assert.equal(email,"owner@fixture.invalid");
      assert.equal(passwordRecord.algorithm,"scrypt");
      return {id:"11111111-1111-4111-8111-111111111111",email};
    },
    async lookup(){
      return null;
    },
    async createSession({userId,refreshTokenHash}){
      assert.equal(userId,"11111111-1111-4111-8111-111111111111");
      assert.match(refreshTokenHash,/^[a-f0-9]{64}$/);
      return {id:"22222222-2222-4222-8222-222222222222",user_id:userId};
    },
  };

  const signup=await routeAuthRequest(
    new Request("https://base.local/v1/auth/signup",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        email:"OWNER@fixture.invalid",
        password:"long-enough-password",
      }),
    }),
    {
      store,
      jwtSecret:"fixture-jwt-signing-key-that-is-long-enough",
      fixtureOnly:true,
    },
  );

  assert.equal(signup.status,201);
  const body=await signup.json();
  const serialized=JSON.stringify(body);
  assert.equal(serialized.includes("long-enough-password"),false);
  assert.equal(serialized.includes("password_digest"),false);
  assert.equal(serialized.includes("refresh_token_hash"),false);

  const oversized=await routeAuthRequest(
    new Request("https://base.local/v1/auth/signup",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({email:"x@fixture.invalid",password:"x".repeat(5000)}),
    }),
    {store,jwtSecret:"fixture-jwt-signing-key-that-is-long-enough",fixtureOnly:true},
  );
  assert.equal(oversized.status,400);
});

test("Base capabilities do not call Auth implemented until persistence and HTTP wiring exist", async () => {
  const {BASE_CAPABILITIES}=await import("../hercules-base/core.mjs");
  assert.equal(BASE_CAPABILITIES.auth.status,"implemented");
});


test("self-hosted Base injects its JWT signing key and fixture-only auth mode", async () => {
  const {readFile}=await import("node:fs/promises");
  const compose=await readFile(new URL("../staging-plane/compose.yml",import.meta.url),"utf8");
  assert.match(compose,/HERCULES_BASE_JWT_SECRET:\s*\$\{HERCULES_STAGING_JWT_SECRET\}/);
  assert.match(compose,/HERCULES_BASE_FIXTURE_ONLY:\s*"true"/);
});
