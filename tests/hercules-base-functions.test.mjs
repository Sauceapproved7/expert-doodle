import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";

import {
  normalizeFunctionManifest,
  functionFingerprint,
} from "../hercules-base/functions-core.mjs";

test("Sparks normalizes bounded function manifests deterministically", () => {
  const manifest=normalizeFunctionManifest({
    name:"resize-image",
    runtime:"node22",
    entrypoint:"index.mjs",
    timeoutMs:5000,
    memoryMb:128,
    network:"none",
    sourceSha256:"a".repeat(64),
  });

  assert.deepEqual(manifest,{
    version:1,
    name:"resize-image",
    runtime:"node22",
    entrypoint:"index.mjs",
    timeoutMs:5000,
    memoryMb:128,
    network:"none",
    sourceSha256:"a".repeat(64),
  });
  assert.match(functionFingerprint(manifest),/^[a-f0-9]{64}$/);
  assert.equal(functionFingerprint(manifest),functionFingerprint({...manifest}));
});

test("Sparks rejects unsafe or unbounded manifests", () => {
  assert.throws(()=>normalizeFunctionManifest({
    name:"bad",
    runtime:"node22",
    entrypoint:"../escape.mjs",
    sourceSha256:"a".repeat(64),
  }),/entrypoint/i);
  assert.throws(()=>normalizeFunctionManifest({
    name:"bad",
    runtime:"node22",
    entrypoint:"index.mjs",
    timeoutMs:999999,
    sourceSha256:"a".repeat(64),
  }),/timeout/i);
  assert.throws(()=>normalizeFunctionManifest({
    name:"bad",
    runtime:"node22",
    entrypoint:"index.mjs",
    network:"all",
    sourceSha256:"a".repeat(64),
  }),/network/i);
});

test("Sparks migration stores manifests privately and records invocations separately", async () => {
  const {readFile}=await import("node:fs/promises");
  const sql=await readFile(
    new URL("../staging-plane/migrations/005_base_functions.sql",import.meta.url),
    "utf8",
  );
  assert.match(sql,/create role staging_functions noinherit nologin/i);
  assert.match(sql,/create table(?: if not exists)? staging_api\.function_manifests/i);
  assert.match(sql,/create table(?: if not exists)? staging_api\.function_invocations/i);
  assert.match(sql,/owner_id uuid not null/i);
  assert.match(sql,/source_sha256 text not null/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on staging_api\.function_manifests from public/i);
  assert.match(sql,/revoke all on staging_api\.function_invocations from public/i);
});

test("Sparks registration binds ownership to JWT subject", async () => {
  const {routeFunctionsRequest}=await import("../hercules-base/functions-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=randomBytes(48).toString("hex");
  const userId="11111111-1111-4111-8111-111111111111";
  const token=signJwtHs256({
    sub:userId,
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);

  let recorded=null;
  const store={
    async register(input){
      recorded=input;
      return {id:"fn_1",name:input.manifest.name,fingerprint:input.fingerprint};
    },
  };

  const response=await routeFunctionsRequest(
    new Request("https://base.local/v1/functions",{
      method:"POST",
      headers:{
        authorization:"Bearer "+token,
        "content-type":"application/json",
      },
      body:JSON.stringify({
        name:"resize-image",
        runtime:"node22",
        entrypoint:"index.mjs",
        timeoutMs:5000,
        memoryMb:128,
        network:"none",
        sourceSha256:"a".repeat(64),
      }),
    }),
    {jwtSecret,store,executor:null},
  );

  assert.equal(response.status,201);
  assert.equal(recorded.ownerId,userId);
  assert.equal(recorded.manifest.name,"resize-image");
});

test("Sparks refuses invocation when hardened executor is unavailable", async () => {
  const {routeFunctionsRequest}=await import("../hercules-base/functions-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=randomBytes(48).toString("hex");
  const token=signJwtHs256({
    sub:"11111111-1111-4111-8111-111111111111",
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);

  let invoked=false;
  const store={
    async get(){return {id:"fn_1",name:"resize-image"};},
    async recordInvocation(){invoked=true;},
  };

  const response=await routeFunctionsRequest(
    new Request("https://base.local/v1/functions/resize-image/invoke",{
      method:"POST",
      headers:{
        authorization:"Bearer "+token,
        "content-type":"application/json",
      },
      body:JSON.stringify({input:{assetId:"x"}}),
    }),
    {jwtSecret,store,executor:null},
  );

  assert.equal(response.status,503);
  assert.equal(invoked,false);
  const body=await response.json();
  assert.equal(body.error,"isolated_function_executor_unavailable");
});

test("Sparks router contains no eval or child-process execution path", async () => {
  const {readFile}=await import("node:fs/promises");
  const source=await readFile(
    new URL("../hercules-base/functions-router.mjs",import.meta.url),
    "utf8",
  );
  assert.equal(/\beval\s*\(/.test(source),false);
  assert.equal(/child_process|spawn\s*\(|exec\s*\(/.test(source),false);
});
