import test from "node:test";
import assert from "node:assert/strict";
import { mtlsEnforced, verifyMtlsIdentity, requireMtlsIdentity } from "../hercules-chat/mtls.mjs";

const identity = (thumbprint="AA") => ({ certificateThumbprint: thumbprint, trusted: true, privateKeyProven: true });
const token = (thumbprint="AA") => ({ cnf: { "x5t#S256": thumbprint } });

test("mTLS enforcement is opt-in", () => {
  assert.equal(mtlsEnforced({}), false);
  assert.equal(mtlsEnforced({ HERCULES_MTLS_ENFORCED: "true" }), true);
});

test("enabled mTLS accepts only trusted certificate-bound identity", () => {
  assert.equal(verifyMtlsIdentity(identity(), token(), true), true);
  assert.equal(verifyMtlsIdentity(identity("BB"), token(), true), false);
});

test("enabled mTLS fails closed without trusted transport proof", () => {
  assert.equal(verifyMtlsIdentity(null, token(), true), false);
  assert.equal(verifyMtlsIdentity({ ...identity(), trusted: false }, token(), true), false);
  assert.equal(verifyMtlsIdentity({ ...identity(), privateKeyProven: false }, token(), true), false);
});

test("mTLS rejects bearer-only internal identity", () => {
  assert.throws(() => requireMtlsIdentity(null, token(), { HERCULES_MTLS_ENFORCED: "true" }), /MTLS_IDENTITY_REQUIRED/);
});
