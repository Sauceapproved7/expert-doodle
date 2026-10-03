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
