import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
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
  const sql=await readFile(new URL("../staging-plane/migrations/003_base_storage.sql",import.meta.url),"utf8");
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
  const jwtSecret=randomBytes(48).toString("hex");
  const response=await routeStorageRequest(
    new Request("https://base.local/v1/storage/buckets",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({name:"private-assets"}),
    }),
    {jwtSecret,store:{},blobs:{}},
  );
  assert.equal(response.status,401);
});
