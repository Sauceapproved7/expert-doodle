# Hercules Cloud — Origin Command Plane v0.1

**Owner:** SauceApproved / Hercules. **Mode:** Isolated, fail-closed **preflight only**. The user owns this repository's original implementation. No Coolify or Dokploy source, branding, UI, assets, installation scripts, containers or proprietary code have been copied.

## Why this exists

Hercules Cloud extends the existing `hercules-deploy/` runtime, rather than creating another provider-dependent deployment service. It takes architectural inspiration from portable Linux hosts, versioned container releases, per-application domains, tracked health and rollback.

The initial reference comparison was made from:
- https://coolify.io/docs/start-with-self-hosted
- https://dokploy.com/self-hosted-paas

These sources are research references only. Their install commands are **not** used or executed here.

## What is implemented

- **Origin Dashboard:** responsive self-contained Hercules-original experience designed for mobile first. No remote fonts, images, analytics or third-party JS.
- **Shadow Dock:** local, interactive deployment manifest validation. It reports **NO** for staging/execution in a public preview and never contacts a production endpoint.
- **Titan Shield:** backend strict-cost check. A candidate sandbox target is accepted only if the preconfigured operator-side target has `verified:true`, `environment:'sandbox'`, and `incrementalMonthlyCostUsd:0` (numeric zero). Any missing, unknown, ambiguous or positive cost is held.
- **Proof Vault:** reads exact source SHA-1 commit and artifact SHA-256 fingerprint. It hashes sanitized manifest identity for provenance; source format alone is not cryptographic signature attestation.
- **Owner-gated local HTTP API:** `/health` is public and truthfully reports planning mode. `/api/capabilities` and `/api/preflight` require a constant-time compared 32+ character bearer token configured out of band. No token means 503, not anonymous access.
- No route calls Docker, SSH, GitHub write APIs, Render/Railway provider writes, payments, DNS, Shopify, authentication providers or production deployments.

`readyForStaging:true` from pure preflight means the locally configured isolated target passed input policy **not** that a deploy was authorized or performed. `executionAuthorized`, `productionAuthorized`, and `launchApproved` are always **false**. Deploy Plane's existing real adapters are deliberately not connected until a separate owner-authorized host, scoped credentials, provider-independent health checks, rollback proofs and no-new-fee guarantee are verified.

## Run locally

Requires Node.js 22+; dependencies: Node built-ins only.

```sh
node --test tests/hercules-cloud-control-plane.test.mjs tests/hercules-cloud-original-ui.test.mjs
node scripts/build_hercules_cloud_preview.mjs
HERCULES_CLOUD_OWNER_TOKEN="<strong-private-token-from-owner-vault>" PORT=8898 node hercules-deploy/cloud/server.mjs
```

Keep the token in local private process configuration only; **do not** paste it into chat, commit it, place it in URL/query, or share it with preview viewers. The built static preview (`dist/hercules-cloud`) contains no private API, tokens or credentials.

From an authorized local/operator process, invoke `createHerculesCloudServer({ownerToken,targets})` with a minimal trusted registry. Example **synthetic** target shape:

```json
{"kind":"owned_linux","reference":"sandbox-01","environment":"sandbox","verified":true,"incrementalMonthlyCostUsd":0}
```

This is a *code-format example*, **not** a verified cost or real server. Set the verified flag only based on independent real host/cost evidence. This release cannot run real Docker deployments even with all preflight checks passing.

## Security / operation limits

1. Cloud control APIs are disabled unless private owner token is configured. Public preview only includes static **illustrative** architecture. No real host state is inferred.
2. No target is implicitly trusted; allowlist is operator-provided and exact-matched.
3. Missing cost attestation blocks staging; a $0 design budget never guarantees zero infrastructure bills.
4. No production or public-registration operations in this module. Existing Shopify, Hercules MCP, Smallz, Studio, Render deployments, payouts, provider approvals and launch gates are unchanged.
5. For an actual self-hosted Railway alternative, a separate owned Linux/Docker executor, encrypted secret store, durable database/volumes, tenant isolation, network/domain engine, health checks, rollback and monitoring must be implemented and independently verified.
6. No public registration, authentication, financial transaction or uptime should be asserted by a static preview.

## Preview deployment plan

Publish `dist/hercules-cloud` on an isolated **static-only** branch-targeted service with auto-deploy **off** after required CI passes and pricing is verified. **Do not merge into main or deploy this to an existing live service** merely to get a preview. Publish is not a production promotion.

## Hercules standard

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
