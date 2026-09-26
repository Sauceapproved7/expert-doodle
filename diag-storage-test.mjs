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

test("portable paths",()=> {
  assert.equal(normalizeBucketName("private-assets"),"private-assets");
  assert.equal(normalizeObjectKey("avatars/user/photo.png"),"avatars/user/photo.png");
});

test("content addressed",async()=>{
  const root=await mkdtemp(join(tmpdir(),"hb-storage-"));
  const blobs=createFilesystemBlobStore({root});
  const payload=Buffer.from("fixture");
  const saved=await blobs.put(payload);
  assert.equal(saved.sha256,sha256Hex(payload));
  assert.equal((await stat(saved.path)).isFile(),true);
  assert.equal((await readFile(saved.path)).toString(),"fixture");
});
