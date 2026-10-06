function isHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function verifiedIssuer(item, issuer) {
  return Boolean(item?.verified && item?.issuer === issuer);
}

function normalizeEvidence(evidence = {}) {
  const passport = evidence.passport;
  if (!passport) return { evidence, passportVerified: null };
  const commitPattern = /^[0-9a-f]{40}$/;
  const commitBound = commitPattern.test(passport.canonicalCommit ?? "") &&
    passport.runtimeCommit === passport.canonicalCommit;
  const vaultChainValid = passport.vaultChainValid === true;
  const passportVerified = passport.schema === "hercules.submission-passport.v1" &&
    commitBound && vaultChainValid;
  const issuer = passport.issuerEvidence ?? {};
  return {
    passportVerified,
    evidence: {
      oauthProviderDiscoveryReady: passport.oauth?.discoveryReady === true,
      runtimeCommitMatchesCanonical: commitBound && vaultChainValid,
      domainChallengeConfigured: verifiedIssuer(issuer.domainChallenge, "openai"),
      publisherVerified: verifiedIssuer(issuer.publisherIdentity, "openai"),
      policyAttested: verifiedIssuer(issuer.policyAttestation, "openai"),
      legalApproved: verifiedIssuer(issuer.legalApproval, "owner-or-qualified-reviewer"),
      demoUrl: passport.urls?.demo === true ? "https://verified.hercules.local/demo-evidence" : "",
      productionScanPassed: passport.productionScan?.passed === true,
      reviewerCredentialsReady: passport.reviewerCredentials?.ready === true,
      _passportUrlEvidence: passport.urls ?? {},
    },
  };
}

export function evaluateSubmissionReadiness(manifest, evidence = {}) {
  const normalized = normalizeEvidence(evidence);
  evidence = normalized.evidence;
  const openai = manifest?.extensions?.["com.openai"] ?? {};
  const ui = openai.interface ?? {};
  const cases = openai.review?.test_cases ?? {};
  const positiveCases = Array.isArray(cases.positive) ? cases.positive.length : 0;
  const negativeCases = Array.isArray(cases.negative) ? cases.negative.length : 0;
  const blockers = [];

  // OpenAI supports CIMD, DCR, or a predefined OAuth client. Provider discovery
  // remains mandatory, but DCR itself is not a submission requirement.
  if (normalized.passportVerified === false) blockers.push("submission_passport_invalid");
  if (!evidence.oauthProviderDiscoveryReady) blockers.push("oauth_provider_discovery_not_ready");
  if (!evidence.runtimeCommitMatchesCanonical) blockers.push("runtime_commit_unverified");
  const urlEvidence = evidence._passportUrlEvidence;
  if (!isHttpsUrl(ui.websiteURL) || (urlEvidence && urlEvidence.website !== true)) blockers.push("website_url_missing");
  if (!isHttpsUrl(ui.supportURL) || (urlEvidence && urlEvidence.support !== true)) blockers.push("support_url_missing");
  if (!isHttpsUrl(ui.privacyPolicyURL) || (urlEvidence && urlEvidence.privacy !== true)) blockers.push("privacy_url_missing");
  if (!isHttpsUrl(ui.termsOfServiceURL) || (urlEvidence && urlEvidence.terms !== true)) blockers.push("terms_url_missing");
  if (!evidence.domainChallengeConfigured) blockers.push("domain_challenge_missing");
  if (!evidence.publisherVerified) blockers.push("publisher_identity_unverified");
  if (!evidence.policyAttested) blockers.push("policy_attestation_missing");
  if (!evidence.legalApproved) blockers.push("legal_approval_missing");
  if (!isHttpsUrl(evidence.demoUrl)) blockers.push("demo_url_missing");
  if (!evidence.productionScanPassed) blockers.push("production_scan_not_passed");
  if (!evidence.reviewerCredentialsReady) blockers.push("reviewer_credentials_missing");
  if (positiveCases !== 5 || negativeCases !== 3) blockers.push("review_case_count_invalid");

  return { ready: blockers.length === 0, blockers, positiveCases, negativeCases, passportVerified: normalized.passportVerified };
}
