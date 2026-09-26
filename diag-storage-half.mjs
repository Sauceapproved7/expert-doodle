import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {sha256Hex,createFilesystemBlobStore} from "../hercules-base/storage-core.mjs";

test("Storage upload binds metadata to JWT subject and hashes the blob", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=randomBytes(48).toString("hex");
  const userId="11111111-1111-4111-8111-111111111111";
  const token=signJwtHs256({sub:userId,role:"staging_user",issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900},jwtSecret);
  let recorded=null;
  const store={async putObject(input){recorded=input;return {bucket:"private-assets",object_key:"docs/readme.txt",sha256:input.sha256,size_bytes:input.sizeBytes,content_type:input.contentType};}};
  const blobs={async put(bytes){return {sha256:sha256Hex(bytes),path:"/blob/path",sizeBytes:bytes.byteLength};}};
  const payload=Buffer.from("owned storage");
  const response=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/docs/readme.txt",{
      method:"PUT",
      headers:{authorization:"Bearer "+token,"content-type":"text/plain"},
      body:payload,
    }),
    {jwtSecret,store,blobs,maxObjectBytes:1024},
  );
  assert.equal(response.status,201);
  assert.equal(recorded.ownerId,userId);
});

test("Storage rejects traversal and oversized objects before persistence", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=randomBytes(48).toString("hex");
  const token=signJwtHs256({sub:"11111111-1111-4111-8111-111111111111",role:"staging_user",issuer:"hercules-base",audience:"hercules-base-api",ttlSeconds:900},jwtSecret);
  let writes=0;
  const store={async putObject(){writes++;}};
  const blobs={async put(){writes++;}};
  const traversal=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/%2e%2e%2fescape",{method:"PUT",headers:{authorization:"Bearer "+token},body:Buffer.from("x")}),
    {jwtSecret,store,blobs,maxObjectBytes:8},
  );
  assert.equal(traversal.status,400);
  const oversized=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/big.bin",{method:"PUT",headers:{authorization:"Bearer "+token},body:Buffer.alloc(9)}),
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
});

test("blob store detects tampering before download", async () => {
  const {writeFile}=await import("node:fs/promises");
  const root=await mkdtemp(join(tmpdir(),"hercules-base-storage-integrity-"));
  const blobs=createFilesystemBlobStore({root});
  const original=Buffer.from("integrity fixture");
  const saved=await blobs.put(original);
  assert.deepEqual(await blobs.get(saved.sha256,{expectedSize:original.byteLength}),original);
  await writeFile(saved.path,Buffer.from("tampered"));
  await assert.rejects(blobs.get(saved.sha256,{expectedSize:original.byteLength}),/integrity/i);
});

test("storage constraints are named", async () => {
  const {readFile}=await import("node:fs/promises");
  const sql=await readFile(new URL("../staging-plane/migrations/003_base_storage.sql",import.meta.url),"utf8");
  assert.match(sql,/storage_buckets_owner_id_name_key/);
  assert.match(sql,/storage_objects_bucket_id_object_key_key/);
});
