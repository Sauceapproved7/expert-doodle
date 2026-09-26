import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {sha256Hex} from "../hercules-base/storage-core.mjs";

test("Storage upload binds metadata to JWT subject and hashes the blob", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
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
