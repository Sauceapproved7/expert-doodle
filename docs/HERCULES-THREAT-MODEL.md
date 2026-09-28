# Hercules Threat Model

Status: security hardening baseline
Date: 2026-09-24

## Assets

Hercules must protect:

- canonical source and release provenance;
- Forge control credentials, sessions, customer workspace authorization and runtime data;
- HURC signing keys and testnet transaction authority;
- model/training checkpoints, activation evidence and datasets;
- video execution artifacts and external-process boundaries;
- audit history, backups and recovery evidence.

## Trust boundaries

1. **Browser/customer -> Forge**: untrusted HTTP input crosses authentication, CSRF, role and schema boundaries.
2. **Browser/customer -> Chat Edge -> AI router**: untrusted prompts, message history, metadata and recalled memory cross JWT, RLS, prompt-composition and internal-router boundaries. Service-role and internal AI credentials must remain server-side.
3. **Operator/app builder -> Hercules Base control -> database/API substrate**: backend intent crosses control-token, blueprint compilation, policy generation and provisioning boundaries; generated plans must never contain runtime credentials, and external PostgreSQL/PostgREST/Docker infrastructure remains outside the owned-code trust boundary.
4. **Forge -> interpreter/model plane**: remote interpreters are external services even when Hercules-controlled.
5. **Forge preview -> host**: preview processes are controlled child processes, not a hardened sandbox for arbitrary hostile server code.
6. **HURC signer -> Vault/database/RPC**: signing authority is high impact; testnet-only restrictions are mandatory.
7. **Training/video -> external runtime**: Python, Wan2.2, FFmpeg, CUDA and other external infrastructure remain outside the owned-core trust boundary.
8. **CI -> repository/release artifacts**: workflow permissions, action pinning and provenance determine supply-chain trust.
9. **Staging -> production**: isolated fixture evidence must never be represented as production operating history.
10. **Forge -> notification transport**: invite/recovery delivery is an external service boundary; one-time lifecycle links are the only credential material intentionally sent to that provider.
11. **Forge/operator -> Deploy Plane**: deployment requests cross a separate authenticated control boundary; jobs may reference deployment targets but must not carry deployment credentials.
12. **Deploy Plane -> target adapter**: target adapters are replaceable infrastructure boundaries; adapters may hold provider/host credentials outside persisted deployment jobs.\n13. **Domain-agent ingress -> authority/provider adapters**: authenticated tasks cross tenant, replay, provider-grant, authority-lease, owner-boundary, AI-routing, and credential-isolation boundaries. The public domain is identity and ingress only; it is never treated as provider permission.

14. **Domain-agent public front door -> private bridge**: `agent.sauceapproved.com` is a public TLS routing boundary. The front door may forward owner JWTs or scoped tenant API keys, but it strips Hercules internal-control headers and never contains service-role or provider credentials.
15. **Domain-agent -> internal service delegation**: the Domain Agent may retrieve only Hercules-owned internal service-control keys from Vault to call already-authorized Hercules services. Provider credentials remain in provider-specific services and are not read by the Domain Agent.
16. **Domain-agent -> execution ledger -> background runner -> worker runtime**: execution eligibility, tenant entitlement, metering, idempotency, job state, runtime isolation, and audit evidence are separate controls. A successful authorization decision does not permit an arbitrary workload.
17. **Tenant API key -> Domain Agent**: customer API keys are hashed at rest, resolved server-side, bound to one organization, expiry/status checked, and must carry explicit `domain-agent:read`, `domain-agent:execute`, `domain-agent:*`, or `*` scope as appropriate.
18. **Commercial plan -> execution allowance**: subscription state and monthly execution limits are authorization-adjacent commercial controls. SauceApproved's founder control-plane entitlement is explicitly marked as an internal owner entitlement and must not be inherited by customer tenants.

19. **AppDeploy secret custody -> canonical launch gate**: production Stripe credentials may remain in the SauceApproved Hercules Titan AppDeploy encrypted secret store. The canonical Supabase launch gate consumes only a fresh credential-free attestation from `hercules_continuity_ledger`; it never receives, exports, or reconstructs the Stripe secret. Provider readiness alone cannot authorize launch: checkout, refund, and payout-state evidence must remain separately verified and bound to the same custody/app identity.
19. **AppDeploy billing custody -> Supabase launch gate**: the owned Hercules Titan runtime may hold Stripe credentials in AppDeploy's encrypted backend-only secret store. The launch gate may consume only the exact HTTPS Titan origin's redacted live readiness, requires a successful Stripe account probe plus live-mode and webhook evidence, binds downstream catalog/payment evidence to a SHA-256 Stripe account fingerprint, and fails closed on timeout, malformed data, account mismatch, or unavailable evidence. No Stripe credential crosses this boundary.

## Primary threats and required controls

### Authentication and session compromise
Controls: memory-hard salted password hashing with explicit parameters, secure HttpOnly cookies, SameSite=Strict, CSRF tokens, login throttling, constant-time secret comparison, bounded sessions, audit events, hashed one-time invite/recovery tokens, generic recovery responses, recovery throttling, and revocation of existing sessions after password recovery.

### Broken tenant authorization
Controls: server-side workspace membership checks, role allowlists, project/workspace binding, no trust in client-supplied ownership.

### Chat prompt and memory contamination
Controls: authenticated JWT ingress, RLS ownership checks, composite session/message ownership keys, server-only assistant/tool/accounting writes, bounded message and metadata sizes, explicit rather than automatic long-term memory writes, owner-scoped semantic retrieval, expired-memory cleanup, and system instructions that treat recalled memory and conversation history as untrusted context rather than authority.

### Secret disclosure
Controls: no committed secrets, no secret-shaped audit fields, Vault custody for signer keys, AppDeploy encrypted backend-only custody for the Titan Stripe credential, no private-key or provider-secret return paths, no logging of bearer tokens, public billing readiness limited to redacted booleans/mode plus a one-way account fingerprint, lifecycle tokens stored only by hash, and invite/recovery tokens carried in URL fragments so they are not sent in the initial HTTP request or referrer.

### Remote-code and process escape
Controls: generated-template constraints, restrictive preview environment, bounded request bodies, explicit child-process allowlist. Hercules does not claim hardened arbitrary-code sandboxing.

### Supply-chain compromise
Controls: SHA-pinned GitHub Actions, compiler checksum verification, owner-code verifier, provenance attestation checklist, immutable commit history, deterministic runtime-source packaging, SPDX SBOM generation, and GitHub-signed release attestations for tagged/manual release-evidence runs. An attestation is evidence only after the release workflow succeeds for the exact release commit.

### Cryptographic implementation defects
Controls: Base Sepolia-only signer boundary, known-answer tests, low-s signatures, deterministic nonces, no mainnet authorization. Independent cryptographic review and differential/fuzz testing are required before real-value use.

### Availability/resource exhaustion
Controls: request-size limits, login throttling, recovery-request throttling, runtime-data quotas, bounded benchmark targets, recovery drills. Broader per-route abuse controls and production capacity evidence remain incomplete.

### Backend blueprint or policy weakening
Controls: fail-closed intent validation, deterministic project identifiers, mandatory Guardian RLS/audit/backup rules, no public database ports in compiled plans, credential-free blueprints, explicit external-infrastructure declarations, vendor-lock-in prohibition in portability manifests, and CI tests that prevent Hercules Base from claiming unfinished capabilities as implemented.

### Deployment-plane compromise
Controls: constant-time Deploy Plane control-token checks, bounded request bodies, secret-shaped job-field rejection, immutable deployment requests, explicit state transitions, persistent verification/rollback evidence, HTTPS-or-loopback internal client transport, and adapter isolation. Provider/host credentials are not stored in deployment jobs.

### Domain-agent confused-deputy, credential and replay risk
Controls: stable HTTPS agent identity, tenant binding, provider/tenant matching, credential-free provider-grant records, authorization-evidence hash binding, authority-lease subject and intent binding, scope/impact/time evaluation, explicit owner-only boundaries, automatic refresh only for refreshable grants, pre-routing authorization, credential-isolated adapters, bounded request bodies, constant-time control-token checks, tenant-scoped idempotency, and deterministic audit fingerprints. Reusing an idempotency key for a different task fails closed.

The domain name itself grants no provider authority. Missing consent, revoked grants, insufficient scopes, 2FA, identity verification, legal consent, and payment boundaries must not be inferred or bypassed.

### Domain-agent API, execution and commercial isolation
Controls: raw credential-shaped task fields are rejected at ingress; tenant API keys are stored only as hashes and resolved through scoped lookup; owner/admin JWTs remain tenant-bound; internal service delegation is limited to named Hercules service keys; safe internal workloads use an explicit allowlist, deny-by-default network policy, ephemeral filesystem and explicit secret allowlisting; provider actions are dispatched only through existing provider-specific Hercules services after live grant resolution; provider-native refresh is permitted only for already-authorized refreshable grants; monthly usage is recorded idempotently under an advisory lock before execution; customer entitlements derive from active plans while the SauceApproved founder workspace uses a separately marked internal entitlement.

The Netlify front door is not a trust anchor. It cannot grant provider authority, cannot inject Hercules internal authorization, and must strip any incoming `x-hercules-internal-key`. A custom hostname is not considered live until hosting alias, DNS and TLS are independently verified.

### External Stripe custody attestation
Controls: exact AppDeploy app identity, explicit `provider=stripe`, `custody=appdeploy`, live-mode, Stripe-reachability and webhook-readiness claims, a 24-hour freshness limit, credential-free provenance, and separate paid-path evidence bound to the same AppDeploy app identity. A provider attestation is readiness evidence only; it does not by itself enable commerce, grant paid entitlement, or satisfy checkout/refund/payout verification. Secret values must never be copied into the continuity ledger, GitHub, Linear, chat, or browser-visible status.

### Audit tampering
Controls: hash-chained audit events and retained head checkpoint. This is tamper-evident application storage, not an independent hardware/external trust anchor.

## Explicit non-claims

Current Hercules evidence does not establish:

- independently audited cryptography;
- hardened sandboxing of arbitrary hostile code;
- multi-region production failover;
- continuous production SLO attainment;
- external penetration-test assurance;
- proof that every historical release has a signed SBOM/provenance attestation; the current release-evidence workflow establishes this control for releases that pass through it;
- multi-factor authentication or externally anchored lifecycle-token issuance/revocation evidence.

These non-claims are security boundaries, not documentation omissions.
