import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";

test("Storage rejects traversal and oversized objects before persistence", async () => {
  const {routeStorageRequest}=await import("../hercules-base/storage-router.mjs");
  const {signJwtHs256}=await import("../hercules-base/auth-core.mjs");
  const jwtSecret=randomBytes(48).toString("hex");
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
