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
    oauthDynamicRegistrationAdvertised: false,
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
    "oauth_dynamic_registration_not_advertised",
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

test("complete evidence passes without weakening required review cases", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";

  const result = evaluateSubmissionReadiness(manifest, {
    oauthProviderDiscoveryReady: true,
    oauthDynamicRegistrationAdvertised: true,
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
    oauthDynamicRegistrationAdvertised: true,
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


test("provider discovery, dynamic registration, and exact runtime commit are independent blockers", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";

  const common = {
    publisherVerified: true,
    policyAttested: true,
    legalApproved: true,
    demoUrl: "https://example.com/reviewer-demo",
    productionScanPassed: true,
    reviewerCredentialsReady: true,
  };

  assert.deepEqual(
    evaluateSubmissionReadiness(manifest, {
      ...common,
      oauthProviderDiscoveryReady: false,
      oauthDynamicRegistrationAdvertised: true,
      runtimeCommitMatchesCanonical: true,
      domainChallengeConfigured: true,
    }).blockers,
    ["oauth_provider_discovery_not_ready"],
  );

  assert.deepEqual(
    evaluateSubmissionReadiness(manifest, {
      ...common,
      oauthProviderDiscoveryReady: true,
      oauthDynamicRegistrationAdvertised: false,
      runtimeCommitMatchesCanonical: true,
      domainChallengeConfigured: true,
    }).blockers,
    ["oauth_dynamic_registration_not_advertised"],
  );

  assert.deepEqual(
    evaluateSubmissionReadiness(manifest, {
      ...common,
      oauthProviderDiscoveryReady: true,
      oauthDynamicRegistrationAdvertised: true,
      runtimeCommitMatchesCanonical: false,
      domainChallengeConfigured: true,
    }).blockers,
    ["runtime_commit_unverified"],
  );
});
