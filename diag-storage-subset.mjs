import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createFilesystemBlobStore} from "../hercules-base/storage-core.mjs";

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
  const workflow=await readFile(new URL("../.github/workflows/hercules-forge-staging.yml",import.meta.url),"utf8");
  assert.match(workflow,/Prove Hercules Base Storage lifecycle/);
  assert.match(workflow,/node scripts\/base-storage-staging-drill\.mjs/);
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
