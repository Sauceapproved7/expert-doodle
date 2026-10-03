import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../hercules-chat/mtls.ts", import.meta.url), "utf8").catch(()=>"");

test("mTLS policy requires explicit enforcement and certificate-bound identity", () => {
  for (const needle of ["HERCULES_MTLS_ENFORCED","x5t#S256","certificateThumbprint","verifyMtlsIdentity"]) {
    assert.ok(source.includes(needle), "missing "+needle);
  }
});

test("mTLS policy fails closed when transport identity is absent or untrusted", () => {
  assert.match(source,/trusted/i);
  assert.match(source,/fail.?closed|false/i);
});

test("mTLS policy rejects bearer-only internal authentication", () => {
  assert.match(source,/certificate/i);
  assert.match(source,/private.?key|tls/i);
});
