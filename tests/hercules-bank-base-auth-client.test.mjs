import test from "node:test";
import assert from "node:assert/strict";

import {HerculesBaseAuthClient} from "../hercules-bank/base-auth-client.mjs";

test("Base Auth client signs in with bounded server-side POST requests", async () => {
  let received;
  const client=new HerculesBaseAuthClient({
    baseUrl:"http://base.internal:8787",
    timeoutMs:1000,
    fetchImpl:async (url,options)=>{
      received={url:String(url),options};
      return new Response(JSON.stringify({
        user:{id:"user-alice",email:"alice@example.test"},
        access_token:"access-secret",
        refresh_token:"refresh-secret",
      }),{status:200,headers:{"content-type":"application/json"}});
    },
  });

  const result=await client.signIn({
    email:"alice@example.test",
    password:"correct horse battery staple",
  });

  assert.equal(received.url,"http://base.internal:8787/v1/auth/signin");
  assert.equal(received.options.method,"POST");
  assert.equal(received.options.redirect,"error");
  assert.equal(received.url.includes("alice"),false);
  assert.equal(received.url.includes("password"),false);
  assert.deepEqual(JSON.parse(received.options.body),{
    email:"alice@example.test",
    password:"correct horse battery staple",
  });
  assert.equal(result.access_token,"access-secret");
});

test("Base Auth client refreshes and revokes without leaking tokens into URLs", async () => {
  const calls=[];
  const client=new HerculesBaseAuthClient({
    baseUrl:"http://base.internal:8787/",
    fetchImpl:async (url,options)=>{
      calls.push({url:String(url),options});
      if(String(url).endsWith("/refresh")){
        return new Response(JSON.stringify({
          user:{id:"user-alice",email:"alice@example.test"},
          access_token:"next-access",
          refresh_token:"next-refresh",
        }),{status:200});
      }
      return new Response(JSON.stringify({ok:true}),{status:200});
    },
  });

  const refreshed=await client.refresh({refresh_token:"refresh-secret"});
  await client.logout({refresh_token:"next-refresh"});

  assert.equal(refreshed.refresh_token,"next-refresh");
  assert.equal(calls[0].url,"http://base.internal:8787/v1/auth/refresh");
  assert.equal(calls[1].url,"http://base.internal:8787/v1/auth/logout");
  assert.equal(calls.every((call)=>!call.url.includes("refresh-secret")&&!call.url.includes("next-refresh")),true);
});

test("Base Auth client fails closed on non-success responses", async () => {
  const client=new HerculesBaseAuthClient({
    baseUrl:"http://base.internal:8787",
    fetchImpl:async ()=>new Response(JSON.stringify({error:"invalid_credentials"}),{status:401}),
  });

  await assert.rejects(
    ()=>client.signIn({email:"alice@example.test",password:"wrong password value"}),
    /authentication|401/i,
  );
});


test("Base Auth client rejects cleartext remote Base Auth endpoints", () => {
  assert.throws(
    () => new HerculesBaseAuthClient({
      baseUrl:"http://base.example.test:8787",
      fetchImpl:async () => new Response("{}"),
    }),
    /HTTPS|loopback/i,
  );
});

test("Base Auth client still permits loopback HTTP for local development", async () => {
  const client=new HerculesBaseAuthClient({
    baseUrl:"http://127.0.0.1:8787",
    fetchImpl:async ()=>new Response(JSON.stringify({
      user:{id:"user-alice",email:"alice@example.test"},
      access_token:"access-secret",
      refresh_token:"refresh-secret",
    }),{status:200}),
  });
  const result=await client.signIn({
    email:"alice@example.test",
    password:"correct horse battery staple",
  });
  assert.equal(result.access_token,"access-secret");
});
