import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  normalizeBucketName,
  normalizeObjectKey,
  sha256Hex,
  createFilesystemBlobStore,
} from "../hercules-base/storage-core.mjs";

test("Storage validates portable bucket names and object keys", () => {
  assert.equal(normalizeBucketName("private-assets"),"private-assets");
  assert.equal(normalizeObjectKey("avatars/user/photo.png"),"avatars/user/photo.png");
  assert.throws(()=>normalizeBucketName("../escape"),/bucket/i);
  assert.throws(()=>normalizeObjectKey("../escape"),/object key/i);
  assert.throws(()=>normalizeObjectKey("/absolute"),/object key/i);
  assert.throws(()=>normalizeObjectKey("a//b"),/object key/i);
});

test("filesystem blob store is content-addressed and never trusts object paths", async () => {
  const root=await mkdtemp(join(tmpdir(),"hercules-base-storage-"));
  const blobs=createFilesystemBlobStore({root});
  const payload=Buffer.from("Hercules Base storage fixture");
  const digest=sha256Hex(payload);

  const first=await blobs.put(payload);
  const second=await blobs.put(payload);

  assert.equal(first.sha256,digest);
  assert.equal(second.sha256,digest);
  assert.equal(first.path,second.path);
  assert.equal((await readFile(first.path)).toString(),payload.toString());
  assert.equal((await stat(first.path)).isFile(),true);
  assert.equal(first.path.includes("avatars"),false);
});

test("storage migration keeps metadata private behind server-only RPCs", async () => {
  const {readFile}=await import("node:fs/promises");
  const sql=await readFile(
    new URL("../staging-plane/migrations/003_base_storage.sql",import.meta.url),
    "utf8",
  );

  assert.match(sql,/create role staging_storage noinherit nologin/i);
  assert.match(sql,/create table(?: if not exists)? staging_api\.storage_buckets/i);
  assert.match(sql,/create table(?: if not exists)? staging_api\.storage_objects/i);
  assert.match(sql,/owner_id uuid not null/i);
  assert.match(sql,/sha256 text not null/i);
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on staging_api\.storage_buckets from public/i);
  assert.match(sql,/revoke all on staging_api\.storage_objects from public/i);
  assert.match(sql,/grant execute on function staging_api\.storage_create_bucket/i);
  assert.match(sql,/grant execute on function staging_api\.storage_put_object/i);
  assert.match(sql,/grant execute on function staging_api\.storage_get_object/i);
  assert.match(sql,/grant execute on function staging_api\.storage_delete_object/i);
});

test("Storage HTTP requires a valid Hercules Base user token", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
  const jwtSecret=String.fromCharCode(...Array(48).fill(109));

  const response=await routeStorageRequest(
    new Request("https://base.local/v1/storage/buckets",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({name:"private-assets"}),
    }),
    {
      jwtSecret,
      store:{},
      blobs:{},
    },
  );

  assert.equal(response.status,401);
});

test("Storage upload binds metadata to JWT subject and hashes the blob", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=String.fromCharCode(...Array(48).fill(109));
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
    async putObject(input){
      recorded=input;
      return {
        bucket:"private-assets",
        object_key:"docs/readme.txt",
        sha256:input.sha256,
        size_bytes:input.sizeBytes,
        content_type:input.contentType,
      };
    },
  };
  const blobs={
    async put(bytes){
      return {sha256:sha256Hex(bytes),path:"/blob/path",sizeBytes:bytes.byteLength};
    },
  };

  const payload=Buffer.from("owned storage");
  const response=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/docs/readme.txt",{
      method:"PUT",
      headers:{
        authorization:"Bearer "+token,
        "content-type":"text/plain",
      },
      body:payload,
    }),
    {jwtSecret,store,blobs,maxObjectBytes:1024},
  );

  assert.equal(response.status,201);
  assert.equal(recorded.ownerId,userId);
  assert.equal(recorded.bucket,"private-assets");
  assert.equal(recorded.objectKey,"docs/readme.txt");
  assert.equal(recorded.sha256,sha256Hex(payload));
  assert.equal(recorded.sizeBytes,payload.byteLength);
});

test("Storage rejects traversal and oversized objects before persistence", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=String.fromCharCode(...Array(48).fill(109));
  const token=signJwtHs256({
    sub:"11111111-1111-4111-8111-111111111111",
    role:"staging_user",
    issuer:"hercules-base",
    audience:"hercules-base-api",
    ttlSeconds:900,
  },jwtSecret);

  let writes=0;
  const store={async putObject(){writes++;}};
  const blobs={async put(){writes++;}};

  const traversal=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/%2e%2e%2fescape",{
      method:"PUT",
      headers:{authorization:"Bearer "+token},
      body:Buffer.from("x"),
    }),
    {jwtSecret,store,blobs,maxObjectBytes:8},
  );
  assert.equal(traversal.status,400);

  const oversized=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/big.bin",{
      method:"PUT",
      headers:{authorization:"Bearer "+token},
      body:Buffer.alloc(9),
    }),
    {jwtSecret,store,blobs,maxObjectBytes:8},
  );
  assert.equal(oversized.status,413);
  assert.equal(writes,0);
});


test("self-hosted Storage uses a persistent blob volume and is reported implemented", async () => {
  const {readFile}=await import("node:fs/promises");
  const {BASE_CAPABILITIES}=await import("../hercules-base/core.mjs");
  const compose=await readFile(new URL("../staging-plane/compose.yml",import.meta.url),"utf8");

  assert.equal(BASE_CAPABILITIES.storage.status,"implemented");
  assert.match(compose,/HERCULES_BASE_STORAGE_ROOT:\s*\/base-storage/);
  assert.match(compose,/hercules_base_storage:\/base-storage/);
  assert.match(compose,/\n  hercules_base_storage:\s*$/m);
});

test("storage lifecycle drill is part of staging CI", async () => {
  const {readFile}=await import("node:fs/promises");
  const workflow=await readFile(
    new URL("../.github/workflows/hercules-forge-staging.yml",import.meta.url),
    "utf8",
  );
  assert.match(workflow,/Prove Hercules Base Storage lifecycle/);
  assert.match(workflow,/node scripts\/base-storage-staging-drill\.mjs/);
});
