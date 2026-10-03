import test from "node:test";
import assert from "node:assert/strict";
import { validateMtlsTrustDomain } from "../hercules-chat/mtls-trust-domain.mjs";

test("trust domain is disabled unless explicitly enforced", () => {
  assert.equal(validateMtlsTrustDomain({}, { trusted: false, privateKeyProven: false }), true);
});

test("enforced trust domain requires trusted transport and configured issuer/SAN policy", () => {
  const env = {
    HERCULES_MTLS_ENFORCED: "true",
    HERCULES_MTLS_TRUSTED_ISSUER_SHA256: "issuer",
    HERCULES_MTLS_EXPECTED_SAN: "spiffe://sauceapproved.com/service/hercules-ai",
  };
  assert.equal(validateMtlsTrustDomain(env, {
    trusted: true, privateKeyProven: true,
    issuerSha256: "issuer",
    san: "spiffe://sauceapproved.com/service/hercules-ai",
  }), true);
});

test("enforced trust domain rejects wrong issuer, SAN, or transport proof", () => {
  const env = {
    HERCULES_MTLS_ENFORCED: "true",
    HERCULES_MTLS_TRUSTED_ISSUER_SHA256: "issuer",
    HERCULES_MTLS_EXPECTED_SAN: "spiffe://sauceapproved.com/service/hercules-ai",
  };
  for (const identity of [
    { trusted: false, privateKeyProven: true, issuerSha256: "issuer", san: env.HERCULES_MTLS_EXPECTED_SAN },
    { trusted: true, privateKeyProven: false, issuerSha256: "issuer", san: env.HERCULES_MTLS_EXPECTED_SAN },
    { trusted: true, privateKeyProven: true, issuerSha256: "other", san: env.HERCULES_MTLS_EXPECTED_SAN },
    { trusted: true, privateKeyProven: true, issuerSha256: "issuer", san: "spiffe://wrong" },
  ]) assert.equal(validateMtlsTrustDomain(env, identity), false);
});
