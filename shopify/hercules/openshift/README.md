# Hercules Shopify on OpenShift

This directory is a parallel migration target for the existing Hercules Shopify control plane. It does not replace the current Supabase webhook/reconciliation path.

Safety defaults:

- API and worker Deployments start with `replicas: 0`.
- The reconciliation CronJob starts with `suspend: true`.
- `COMMERCE_ENABLED` remains `false`.
- Shopify secrets are referenced through `secretKeyRef`; no secret object or secret value is committed here.
- API, worker, and reconciler use separate service accounts.
- Workloads drop Linux capabilities, run non-root, use a read-only root filesystem, and use RuntimeDefault seccomp.
- The public Route targets only the API service; worker and reconciler are not exposed.

Promotion requires a reviewed app image, durable PostgreSQL/queue wiring, end-to-end webhook persistence tests, Shopify GraphQL reconciliation tests, image/SBOM/security evidence, and an explicit production authorization. The current live Shopify path remains authoritative until that evidence exists.


## Hardened webhook admission

The API Route is re-encrypt TLS and exposes only `/webhooks/shopify`. The service uses an OpenShift service-serving certificate. The API verifies Shopify HMAC over the untouched raw body, validates the exact production shop and topic allowlist, then performs one purpose-scoped atomic inbox/outbox RPC before returning success.

The checked-in image digest of all zeros is a deliberate non-runnable sentinel. Before increasing replicas above zero, release automation must replace it with the exact reviewed image digest and retain SBOM/signature evidence. Do not replace it with `:latest`.

The public API secret scope is limited to the Shopify client secret, purpose-scoped ingest token, and Supabase endpoint/anon key. It must not receive Shopify Admin API tokens, Stripe credentials, Supabase service-role keys, or Kubernetes API credentials.

The base NetworkPolicy restricts ingress to the OpenShift ingress namespace and egress to DNS plus TCP/443. A production cluster should further narrow HTTPS egress using its supported EgressFirewall/AdminNetworkPolicy/FQDN controls once the managed Supabase endpoint addresses are known.
