# Hercules Live Commerce Core

Current stage: tested control-plane primitives; not an end-to-end or deployable product.

control-plane.mjs provides a bounded session lifecycle, version-checked Shopify product pins, and short-lived HMAC-SHA256 realtime tickets. The current implementation does not host video, provide a viewer/host UI, persist sessions, connect a chat or streaming provider, accept orders, or enable checkout. commerceEnabled stays false; product pinning records metadata and does not mutate Shopify.

## Security properties

- A session transition requires the caller's expected current state and advances its version. Product pins require the current version, reject terminal or unknown states, and cannot enable commerce.
- Realtime tickets bind event ID, explicit audience, allowed scopes, issue time, and a maximum 15-minute lifetime. Verification requires the expected audience and event ID from trusted server-side request context, validates the claim shape and lifetime, and checks HMAC-SHA256 signatures in constant time.
- The HMAC key must be at least 32 bytes and must come from a secret manager or deployment secret. Never commit it or place it in browser-visible configuration.

These primitives do not replace authenticated host/viewer sessions, replay protection, rate limits, transport security, durable persistence, provider authorization, or end-to-end security review. Do not expose this module as a public API until those controls and the production integrations are implemented and tested.

## Release gates still open

1. Choose and authorize a video/live provider and define its integration contract.
2. Add authenticated host and viewer APIs, durable session/product-pin storage, replay handling, rate limits, and observability.
3. Integrate Shopify catalog links and the authorized order/fulfillment path without changing the existing paid-commerce gates.
4. Build and test the host/viewer experience, provider failure behavior, webhook/order reconciliation, and accessibility.
5. Produce image, SBOM, and security evidence; verify the OpenShift target and obtain the required deployment authorization.

The parallel OpenShift migration manifests in shopify/hercules/openshift remain inactive by default. They do not make this core live, and they do not replace the currently authoritative Shopify webhook/reconciliation path.
