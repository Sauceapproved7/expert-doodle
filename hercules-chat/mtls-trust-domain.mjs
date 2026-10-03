export type MtlsTransportIdentity = {
  trusted: boolean;
  privateKeyProven: boolean;
  issuerSha256?: string;
  san?: string;
};

export type MtlsTrustDomainConfig = {
  enforced: boolean;
  issuerSha256?: string;
  expectedSan?: string;
};

export function mtlsTrustDomainConfig(
  env: Record<string, string | undefined> = {},
): MtlsTrustDomainConfig {
  return {
    enforced: (env.HERCULES_MTLS_ENFORCED ?? "").toLowerCase() === "true",
    issuerSha256: env.HERCULES_MTLS_TRUSTED_ISSUER_SHA256,
    expectedSan: env.HERCULES_MTLS_EXPECTED_SAN,
  };
}

export function validateMtlsTrustDomain(
  env: Record<string, string | undefined>,
  identity: MtlsTransportIdentity | null | undefined,
): boolean {
  const cfg = mtlsTrustDomainConfig(env);
  if (!cfg.enforced) return true;
  if (!identity?.trusted || !identity.privateKeyProven) return false;
  if (!cfg.issuerSha256 || !cfg.expectedSan) return false;
  if (identity.issuerSha256 !== cfg.issuerSha256) return false;
  if (identity.san !== cfg.expectedSan) return false;
  return true;
}
