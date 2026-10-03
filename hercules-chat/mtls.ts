export type MtlsIdentity = {
  certificateThumbprint: string;
  subject?: string;
  trusted: boolean;
  privateKeyProven: boolean;
};

export type CertificateBoundToken = {
  cnf?: { "x5t#S256"?: string };
};

export function mtlsEnforced(env: Record<string, string | undefined> = {}) {
  return (env.HERCULES_MTLS_ENFORCED ?? "").toLowerCase() === "true";
}

/**
 * The edge/application layer must receive this identity only from a trusted
 * TLS terminator or service-mesh adapter that has already completed the
 * client-certificate handshake. Public client-controlled headers are never
 * accepted as proof of mTLS.
 */
export function verifyMtlsIdentity(
  identity: MtlsIdentity | null | undefined,
  token: CertificateBoundToken | null | undefined,
  enforced = false,
): boolean {
  if (!enforced) return true;
  if (!identity?.trusted || !identity.privateKeyProven) return false;

  const presented = identity.certificateThumbprint.trim();
  const bound = token?.cnf?.["x5t#S256"]?.trim() ?? "";
  if (!presented || !bound || presented.length !== bound.length) return false;

  let diff = 0;
  for (let i = 0; i < presented.length; i++) {
    diff |= presented.charCodeAt(i) ^ bound.charCodeAt(i);
  }
  return diff === 0;
}

export function requireMtlsIdentity(
  identity: MtlsIdentity | null | undefined,
  token: CertificateBoundToken | null | undefined,
  env: Record<string, string | undefined> = {},
): void {
  if (!verifyMtlsIdentity(identity, token, mtlsEnforced(env))) {
    throw new Error("MTLS_IDENTITY_REQUIRED");
  }
}
