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
    oauthProviderReady: false,
    domainChallengeConfigured: false,
    publisherVerified: false,
    policyAttested: false,
    legalApproved: false,
    demoUrl: "",
    productionScanPassed: false,
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "oauth_provider_not_ready",
    "privacy_url_missing",
    "terms_url_missing",
    "domain_challenge_missing",
    "publisher_identity_unverified",
    "policy_attestation_missing",
    "legal_approval_missing",
    "demo_url_missing",
    "production_scan_not_passed",
  ]);
});

test("complete evidence passes without weakening required review cases", () => {
  const manifest = structuredClone(baseManifest);
  manifest.extensions["com.openai"].interface.privacyPolicyURL = "https://example.com/privacy";
  manifest.extensions["com.openai"].interface.termsOfServiceURL = "https://example.com/terms";

  const result = evaluateSubmissionReadiness(manifest, {
    oauthProviderReady: true,
    domainChallengeConfigured: true,
    publisherVerified: true,
    policyAttested: true,
    legalApproved: true,
    demoUrl: "https://example.com/reviewer-demo",
    productionScanPassed: true,
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
    oauthProviderReady: true,
    domainChallengeConfigured: true,
    publisherVerified: true,
    policyAttested: true,
    legalApproved: true,
    demoUrl: "https://example.com/reviewer-demo",
    productionScanPassed: true,
  });

  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("review_case_count_invalid"));
});
