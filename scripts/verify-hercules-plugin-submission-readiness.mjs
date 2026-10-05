function isHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function evaluateSubmissionReadiness(manifest, evidence = {}) {
  const openai = manifest?.extensions?.["com.openai"] ?? {};
  const ui = openai.interface ?? {};
  const cases = openai.review?.test_cases ?? {};
  const positiveCases = Array.isArray(cases.positive) ? cases.positive.length : 0;
  const negativeCases = Array.isArray(cases.negative) ? cases.negative.length : 0;
  const blockers = [];

  if (!evidence.oauthProviderDiscoveryReady) blockers.push("oauth_provider_discovery_not_ready");
  if (!evidence.oauthDynamicRegistrationAdvertised) blockers.push("oauth_dynamic_registration_not_advertised");
  if (!evidence.runtimeCommitMatchesCanonical) blockers.push("runtime_commit_unverified");
  if (!isHttpsUrl(ui.websiteURL)) blockers.push("website_url_missing");
  if (!isHttpsUrl(ui.supportURL)) blockers.push("support_url_missing");
  if (!isHttpsUrl(ui.privacyPolicyURL)) blockers.push("privacy_url_missing");
  if (!isHttpsUrl(ui.termsOfServiceURL)) blockers.push("terms_url_missing");
  if (!evidence.domainChallengeConfigured) blockers.push("domain_challenge_missing");
  if (!evidence.publisherVerified) blockers.push("publisher_identity_unverified");
  if (!evidence.policyAttested) blockers.push("policy_attestation_missing");
  if (!evidence.legalApproved) blockers.push("legal_approval_missing");
  if (!isHttpsUrl(evidence.demoUrl)) blockers.push("demo_url_missing");
  if (!evidence.productionScanPassed) blockers.push("production_scan_not_passed");
  if (!evidence.reviewerCredentialsReady) blockers.push("reviewer_credentials_missing");
  if (positiveCases !== 5 || negativeCases !== 3) blockers.push("review_case_count_invalid");

  return {
    ready: blockers.length === 0,
    blockers,
    positiveCases,
    negativeCases,
  };
}
