import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSubmissionReadiness } from "../scripts/verify-hercules-plugin-submission-readiness.mjs";

const baseManifest = {
  extensions: {
    "com.openai": {
      interface: {
        websiteURL: "https://hercules-mcp.onrender.com/plugin",
        supportURL: "https://hercules-mcp.onrender.com/plugin/support",
      },
      review: {
        test_cases: {
          positive: Array.from({ length: 5 }, (_, i) => ({ prompt: `positive-${i}` })),
          negative: Array.from({ length: 3 }, (_, i) => ({ prompt: `negative-${i}` })),
        },
      },
    },
  },
};

test("current protected boundaries fail closed with exact blockers", () => {
  const result = evaluateSubmissionReadiness(baseManifest, {
    oauthProviderDiscoveryReady: false,
    runtimeCommitMatchesCanonical: false,
    domainChallengeConfigured: false,
    publisherVerified: false,
    policyAttested: false,
    legalApproved: false,
    demoUrl: "",
    productionScanPassed: false,
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "oauth_provider_discovery_not_ready",
    "runtime_commit_unverified",
    "privacy_url_missing",
    "terms_url_missing",
    "domain_challenge_missing",
    "publisher_identity_unverified",
    "policy_attestation_missing",
    "legal_approval_missing",
    "demo_url_missing",
    "production_scan_not_passed",
    "reviewer_credentials_missing",
  ]);
});

test("complete evidence passes without requiring DCR", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";
  const result = evaluateSubmissionReadiness(manifest, {
    oauthProviderDiscoveryReady: true,
    oauthDynamicRegistrationAdvertised: false,
    runtimeCommitMatchesCanonical: true,
    domainChallengeConfigured: true,
    publisherVerified: true,
    policyAttested: true,
    legalApproved: true,
    demoUrl: "https://example.com/reviewer-demo",
    productionScanPassed: true,
    reviewerCredentialsReady: true,
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.positiveCases, 5);
  assert.equal(result.negativeCases, 3);
});

test("wrong review-case counts remain a blocker", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].review.test_cases.positive.pop();
  const result = evaluateSubmissionReadiness(manifest, {
    oauthProviderDiscoveryReady: true,
    runtimeCommitMatchesCanonical: true,
    domainChallengeConfigured: true,
    publisherVerified: true,
    policyAttested: true,
    legalApproved: true,
    demoUrl: "https://example.com/reviewer-demo",
    productionScanPassed: true,
    reviewerCredentialsReady: true,
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("review_case_count_invalid"));
});

test("provider discovery and exact runtime commit remain independent blockers", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";
  const common = {
    publisherVerified: true, policyAttested: true, legalApproved: true,
    demoUrl: "https://example.com/reviewer-demo", productionScanPassed: true,
    reviewerCredentialsReady: true, domainChallengeConfigured: true,
  };
  assert.deepEqual(evaluateSubmissionReadiness(manifest,{...common,oauthProviderDiscoveryReady:false,runtimeCommitMatchesCanonical:true}).blockers,["oauth_provider_discovery_not_ready"]);
  assert.deepEqual(evaluateSubmissionReadiness(manifest,{...common,oauthProviderDiscoveryReady:true,runtimeCommitMatchesCanonical:false}).blockers,["runtime_commit_unverified"]);
});


test("submission passport verifies machine evidence and keeps issuer proofs fail closed", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";

  const passport = {
    schema: "hercules.submission-passport.v1",
    canonicalCommit: "a".repeat(40),
    runtimeCommit: "a".repeat(40),
    vaultChainValid: true,
    oauth: { discoveryReady: true },
    urls: { website: true, support: true, privacy: true, terms: true, demo: true },
    productionScan: { passed: true },
    reviewerCredentials: { ready: true },
    issuerEvidence: {
      domainChallenge: { verified: false, issuer: "openai" },
      publisherIdentity: { verified: false, issuer: "openai" },
      policyAttestation: { verified: false, issuer: "openai" },
      legalApproval: { verified: false, issuer: "owner-or-qualified-reviewer" },
    },
  };

  const result = evaluateSubmissionReadiness(manifest, { passport });
  assert.equal(result.ready, false);
  assert.equal(result.passportVerified, true);
  assert.deepEqual(result.blockers, [
    "domain_challenge_missing",
    "publisher_identity_unverified",
    "policy_attestation_missing",
    "legal_approval_missing",
  ]);
});

test("submission passport rejects tampered or mismatched runtime evidence", () => {
  const result = evaluateSubmissionReadiness(baseManifest, {
    passport: {
      schema: "hercules.submission-passport.v1",
      canonicalCommit: "a".repeat(40),
      runtimeCommit: "b".repeat(40),
      vaultChainValid: false,
      oauth: { discoveryReady: true },
      urls: {},
      productionScan: { passed: true },
      reviewerCredentials: { ready: true },
      issuerEvidence: {},
    },
  });
  assert.equal(result.passportVerified, false);
  assert.ok(result.blockers.includes("submission_passport_invalid"));
  assert.ok(result.blockers.includes("runtime_commit_unverified"));
});

test("verified issuer evidence can complete the passport without manual boolean overrides", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";
  const passport = {
    schema: "hercules.submission-passport.v1",
    canonicalCommit: "c".repeat(40),
    runtimeCommit: "c".repeat(40),
    vaultChainValid: true,
    oauth: { discoveryReady: true },
    urls: { website: true, support: true, privacy: true, terms: true, demo: true },
    productionScan: { passed: true },
    reviewerCredentials: { ready: true },
    issuerEvidence: {
      domainChallenge: { verified: true, issuer: "openai" },
      publisherIdentity: { verified: true, issuer: "openai" },
      policyAttestation: { verified: true, issuer: "openai" },
      legalApproval: { verified: true, issuer: "owner-or-qualified-reviewer" },
    },
  };
  const result = evaluateSubmissionReadiness(manifest, { passport });
  assert.equal(result.ready, true);
  assert.equal(result.passportVerified, true);
  assert.deepEqual(result.blockers, []);
});
