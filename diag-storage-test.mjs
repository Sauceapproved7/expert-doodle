import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";

test("jwt scoped storage fixture", async () => {
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
  const store={async putObject(input){recorded=input;return {id:1};}};
  const blobs={async put(bytes){return {sha256:"0".repeat(64),sizeBytes:bytes.byteLength};}};
  const response=await routeStorageRequest(
    new Request("https://base.local/v1/storage/objects/private-assets/docs/readme.txt",{
      method:"PUT",
      headers:{authorization:"Bearer "+token},
      body:Buffer.from("x"),
    }),
    {jwtSecret,store,blobs,maxObjectBytes:8},
  );
  assert.equal(response.status,201);
  assert.equal(recorded.ownerId,userId);
});
