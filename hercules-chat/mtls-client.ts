export type MtlsClientConfig = {
  enforced: boolean;
  cert?: string;
  key?: string;
  caCert?: string;
};

export function mtlsClientConfig(env: Record<string, string | undefined> = {}): MtlsClientConfig {
  return {
    enforced: (env.HERCULES_MTLS_ENFORCED ?? "").toLowerCase() === "true",
    cert: env.HERCULES_MTLS_CLIENT_CERT,
    key: env.HERCULES_MTLS_CLIENT_KEY,
    caCert: env.HERCULES_MTLS_CA_CERT,
  };
}

export function assertMtlsClientConfig(config: MtlsClientConfig): void {
  if (!config.enforced) return;
  if (!config.cert || !config.key) throw new Error("MTLS_CLIENT_CERT_NOT_CONFIGURED");
}

export function createMtlsHttpClient(config: MtlsClientConfig) {
  assertMtlsClientConfig(config);
  if (!config.enforced) return undefined;
  return Deno.createHttpClient({
    cert: config.cert,
    key: config.key,
    ...(config.caCert ? { caCerts: [config.caCert] } : {}),
  });
}
