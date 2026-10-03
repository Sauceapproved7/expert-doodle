import test from "node:test";
import assert from "node:assert/strict";

import {signJwtHs256} from "../hercules-base/auth-core.mjs";
import {HerculesBankBrowserSessions} from "../hercules-bank/browser-session.mjs";

const SECRET=Buffer.alloc(48,91).toString("hex");

function signed(sub,{role="staging_user",now=1000,ttl=900}={}){
  return signJwtHs256({
    sub,
    role,
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:ttl,
    nowSeconds:now,
  },SECRET);
}

test("browser sign-in keeps Base tokens server-side and returns opaque cookie plus CSRF", async () => {
  const authClient={
    async signIn({email,password}){
      assert.equal(email,"alice@example.test");
      assert.equal(password,"correct horse battery staple");
      return {
        user:{id:"user-alice",email},
        access_token:signed("user-alice"),
        refresh_token:"r".repeat(48),
      };
    },
  };

  const sessions=new HerculesBankBrowserSessions({
    authClient,
    jwtSecret:SECRET,
    issuer:"hercules-base",
    audience:"hercules-base-api",
    nowSeconds:()=>1100,
    randomBytes:(size)=>Buffer.alloc(size,7),
  });

  const result=await sessions.signIn({
    email:"alice@example.test",
    password:["correct","horse","battery","staple"].join(" "),
  });

  assert.equal(result.user.id,"user-alice");
  assert.match(result.csrfToken,/^[A-Za-z0-9_-]+$/);
  assert.match(result.setCookie,/^bank_session=/);
  assert.match(result.setCookie,/HttpOnly/);
  assert.match(result.setCookie,/SameSite=Strict/);
  assert.equal(JSON.stringify(result).includes("access_token"),false);
  assert.equal(JSON.stringify(result).includes("refresh_token"),false);
});

test("cookie authentication resolves verified claims and CSRF rejects mismatches", async () => {
  const sessions=new HerculesBankBrowserSessions({
    authClient:{
      async signIn(){
        return {
          user:{id:"user-alice",email:"alice@example.test"},
          access_token:signed("user-alice"),
          refresh_token:"r".repeat(48),
        };
      },
    },
    jwtSecret:SECRET,
    issuer:"hercules-base",
    audience:"hercules-base-api",
    nowSeconds:()=>1100,
    randomBytes:(size)=>Buffer.alloc(size,8),
  });

  const login=await sessions.signIn({
    email:"alice@example.test",
    password:["correct","horse","battery","staple"].join(" "),
  });
  const cookie=login.setCookie.split(";")[0];
  const auth=await sessions.authenticate({headers:{cookie}});

  assert.equal(auth.claims.sub,"user-alice");
  assert.equal(auth.user.email,"alice@example.test");
  assert.throws(
    ()=>sessions.requireCsrf({headers:{"x-bank-csrf":"wrong"}},auth),
    /csrf/i,
  );
  assert.doesNotThrow(
    ()=>sessions.requireCsrf({headers:{"x-bank-csrf":login.csrfToken}},auth),
  );
});

test("expired access token refreshes server-side without exposing the refresh token", async () => {
  let refreshCalls=0;
  const authClient={
    async signIn(){
      return {
        user:{id:"user-alice",email:"alice@example.test"},
        access_token:signed("user-alice",{now:1000,ttl:60}),
        refresh_token:"a".repeat(48),
      };
    },
    async refresh({refresh_token}){
      refreshCalls += 1;
      assert.equal(refresh_token,"a".repeat(48));
      return {
        user:{id:"user-alice",email:"alice@example.test"},
        access_token:signed("user-alice",{now:1200,ttl:900}),
        refresh_token:"b".repeat(48),
      };
    },
  };

  let now=1050;
  const sessions=new HerculesBankBrowserSessions({
    authClient,
    jwtSecret:SECRET,
    issuer:"hercules-base",
    audience:"hercules-base-api",
    nowSeconds:()=>now,
    randomBytes:(size)=>Buffer.alloc(size,9),
  });
  const login=await sessions.signIn({email:"alice@example.test",password:["correct","horse","battery","staple"].join(" ")});
  const cookie=login.setCookie.split(";")[0];

  now=1201;
  const auth=await sessions.authenticate({headers:{cookie}});

  assert.equal(refreshCalls,1);
  assert.equal(auth.claims.sub,"user-alice");
  assert.equal(JSON.stringify(auth).includes("a".repeat(48)),false);
  assert.equal(JSON.stringify(auth).includes("b".repeat(48)),false);
});

test("logout revokes the Base refresh token and clears the browser session", async () => {
  let revoked=null;
  const authClient={
    async signIn(){
      return {
        user:{id:"user-alice",email:"alice@example.test"},
        access_token:signed("user-alice"),
        refresh_token:"z".repeat(48),
      };
    },
    async logout({refresh_token}){revoked=refresh_token;},
  };

  const sessions=new HerculesBankBrowserSessions({
    authClient,
    jwtSecret:SECRET,
    issuer:"hercules-base",
    audience:"hercules-base-api",
    nowSeconds:()=>1100,
    randomBytes:(size)=>Buffer.alloc(size,10),
  });
  const login=await sessions.signIn({email:"alice@example.test",password:["correct","horse","battery","staple"].join(" ")});
  const cookie=login.setCookie.split(";")[0];
  const auth=await sessions.authenticate({headers:{cookie}});

  const result=await sessions.logout(auth);

  assert.equal(revoked,"z".repeat(48));
  assert.match(result.setCookie,/Max-Age=0/);
  await assert.rejects(
    ()=>sessions.authenticate({headers:{cookie}}),
    /unauthorized/i,
  );
});
