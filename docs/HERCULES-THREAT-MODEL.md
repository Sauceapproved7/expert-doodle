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
20. **Founding Pilot handoff -> launch admission**: a protected, already-qualified marketing contact crosses a one-time admission boundary. Raw handoff material exists only in transit; Hercules stores only SHA-256, GET performs validation/read-only rendering, and state changes require an explicit POST. Admission may create only a dedicated pilot organization and must not join the user to the founder organization or flip the global public-registration release switch. Supabase service-role and Vault material remain server-side; the browser receives only the publishable key and the admitted user's own session.\n21. **Pilot admission control -> Vault-backed internal authorization**: automated synthetic certification uses the dedicated `pilot-admission-control` service key, stored in Vault and compared by SHA-256. Internal certification is synthetic-only; real qualified contacts require the owner-authorized private-bridge path.\n\n19. **AppDeploy billing custody -> Supabase launch gate**: the owned Hercules Titan runtime may hold Stripe credentials in AppDeploy's encrypted backend-only secret store. The launch gate may consume only the exact HTTPS Titan origin's redacted live readiness, requires a successful Stripe account probe plus live-mode and webhook evidence, binds downstream catalog/payment evidence to a SHA-256 Stripe account fingerprint, and fails closed on timeout, malformed data, account mismatch, or unavailable evidence. No Stripe credential crosses this boundary.

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

### Controlled Founding Pilot admission\nControls: protected `marketing_contacts` qualification metadata is revalidated at issuance and redemption; consumer/third-party/legal-collection use is excluded by the controlled receivables scope and acknowledgement gates; 256-bit random handoff tokens are stored only as SHA-256; GET has no writes or Auth side effects; POST requires explicit acceptance and atomically moves `issued -> redeeming -> accepted`; expired/replayed tokens fail closed; real prospects cannot use the synthetic-certification path; synthetic certification is restricted to synthetic-qualified `@example.com` contacts; admitted Auth users cannot be the founder account or an active founder-organization member; organization insertion deliberately preserves the existing provisioning trigger; public registration must remain closed; no Stripe/checkout activation is performed; first-session establishment exchanges a server-generated magic-link token hash directly and does not depend on an Auth redirect allow-list; Password Defense v2 remains authoritative for any later password setup, and the pilot handoff itself does not create or accept a password.\n\n### Audit tampering
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


### SmokeScreen defensive-deception boundary

22. **Security telemetry -> SmokeScreen Sentinel -> local enforcement/decoy plane**: untrusted request, authentication, and runtime signals cross a normalization and policy boundary before any defensive action is recommended. The Sentinel emits only bounded, abstract, owned-infrastructure actions and never receives authority to attack, scan, exploit, access, or modify an external system. HMAC material remains server-side. Decoy routes must be isolated from real credentials, customer data, payment systems, signing authority, and production administration. A decision is not execution authority; an independently authorized local adapter must enforce it.

### Adaptive deception and false-positive containment

Controls: bounded input fields, explicit signal allowlist, deterministic risk scoring, fail-closed signal validation, maximum 1500 ms tarpit delay, no outbound counterattack path, HMAC-derived session/route/decoy fingerprints, no raw session identifiers in decision output, isolated decoy-only routing at high risk, honeytoken-triggered critical containment, tamper-evident HMAC audit chaining, bounded retained audit windows with checkpoint anchors, and staged rollout from observe-only through containment. SmokeScreen must never place real secrets or customer records in a decoy surface and must preserve an immediate path back to normal routing for false-positive remediation.


### SmokeScreen Mirage Fabric v2

Controls: every Mirage Fabric is derived only from an already-decoy-classified SmokeScreen decision; topology generation uses HMAC-bound synthetic identifiers; arbitrary attacker-controlled labels are reduced to a fixed focus allowlist; all Mirage data is synthetic; real asset access is false; network policy is isolated with no egress; production credentials, customer data, payment keys, and signing authority are forbidden; execution authority remains false; outbound counterattack remains false; topology generations may mutate only within the same synthetic containment boundary; and enforcement must fail closed to denial when isolation controls cannot be proven.


### Forge -> SmokeScreen observe-only ingress

Controls: Forge attaches observation only after an HTTP response completes; observation failure cannot alter the already-determined customer response; raw remote addresses and user-agent strings are reduced to a one-way client fingerprint before appearing in SmokeScreen results; request-window state is bounded by time, per-client entry count, and total client count; only normalized defensive signals are passed to the Sentinel; public health reveals only enabled/mode/enforcement booleans; aggregate metrics require the existing Forge bearer control credential; production starts in `OBSERVE_ONLY` with `enforcementApplied=false`; and any later transition to friction, deception, or containment requires a distinct reviewed change with false-positive evidence.


### Hercules Cleaner local filesystem boundary

23. **User filesystem -> Cleaner policy engine -> Recovery Vault**: local file metadata crosses an allowlisted-root, protected-path, disposable-rule and freshness boundary before any cleanup plan is produced. Cleanup execution is local only and moves approved files into a per-run Recovery Capsule before any later purge.

Controls: loopback-only dashboard binding, per-process control token, origin checks, bounded request bodies, symlink non-following, explicit protected paths, user-scoped defaults, scan depth/file-count caps, time-of-check revalidation before moving a file, SHA-256 capsule integrity, fail-closed restore when a destination already exists, a single-operation lock, retained manifests, and no automatic cleaning of Documents/Desktop/Pictures/Videos/Music/SSH/GnuPG defaults. Native startup uses user-level OS facilities only; system scheduler/launch infrastructure remains outside owned Hercules code.


### SmokeScreen ATT&CK enrichment boundary

24. **Normalized SmokeScreen telemetry -> ATT&CK candidate enrichment -> operator evidence**: normalized request/authentication evidence crosses a taxonomy boundary where behavioral indicators are mapped to candidate MITRE ATT&CK techniques. ATT&CK metadata must not be treated as proof of actor identity, campaign identity, compromise success, or authorization for enforcement.

Controls: candidate-only output; explicit confidence and corroboration fields; fixed technique allowlist reviewed against MITRE public documentation; bounded route categories instead of raw route disclosure; no inference of `T1046 Network Service Discovery` without network-service telemetry; no inference of `T1078 Valid Accounts` without successful-account-use evidence; `actorAttribution=false`; `campaignAttribution=false`; `automaticResponseAuthority=false`; `outboundCounterattack=false`; and Forge remains `OBSERVE_ONLY` during this stage.


### Vault-backed deployment broker boundary

25. **Hercules control plane -> Supabase Vault-backed deploy broker -> Render production API**: an authenticated internal deployment request crosses a server-side credential-custody and provider-mutation boundary. The request may identify only an allowlisted target, exact source commit, and bounded provider deployment ID; it must not carry provider credentials.

Controls: constant-time internal-key digest comparison; service-role-only target registry; Supabase Vault retrieval for `deploy-broker-control` and `render-deployer`; credential-free request/state/evidence; fixed Render API origin; exact service-ID and commit/deployment-ID validation; redirects disabled; bounded network timeouts; explicit allowlist resolution; live exact-commit verification; independent public `/health` verification; unauthenticated `/mcp` 401/403 verification; bounded rollback; safe error-code projection; and fail-closed behavior when credentials or targets are unavailable. The broker does not mint provider credentials, bypass Render authorization, or treat provider status alone as proof of application health.

### Operator security source registry boundary

The existing Forge bearer-authenticated operator API reads a local security-source metadata snapshot, not remote source artifacts. Loading requires the separately pinned catalog SHA-256. Input bytes, source counts, policy enums, HTTPS source URLs, IDs, and relationship targets are validated before search. Search inputs and result counts are bounded; unknown/duplicate query parameters are rejected. Hazardous entries remain quarantined metadata with no fetch or execution authority. Returned records are independent copies. No user-controlled URL, path, catalog checksum, or payload can trigger network retrieval or filesystem traversal. Canonical and alternate source links are informational. Existing no-store response headers and operator credential validation remain in force; catalog failure closes with 503. Freshness observations are historical snapshots, not proof of current source completeness.


### Public MCP OAuth provider boundary

26. **ChatGPT/Codex MCP client -> OAuth provider -> Hercules MCP resource server**: an untrusted bearer token crosses an external identity-provider boundary before any of the five public read-only Hercules tools may run. Owner-token authorization remains a separate control path.

Controls: provider mode is explicit and fail-closed; an empty mode authorizes no public OAuth; the generic introspection verifier remains isolated from the Supabase verifier; Supabase mode uses only a publishable project key to ask the project Auth server to validate the bearer token, never a service-role or JWT signing secret; after provider validation Hercules independently checks exact issuer, expected audience, expiration, optional not-before, non-empty OAuth client ID, and subject equality with the provider-validated user record; malformed JWT payloads fail closed; the five public tools remain read-only, non-destructive, closed-world, idempotent, and response-minimized; owner bearer credentials are never returned to or exchanged with the OAuth provider.

Unauthenticated MCP responses advertise a slash-separated protected-resource metadata URL. CI follows the exact challenge URL back to the metadata route and checks rejection of missing or invalid credentials; discovery does not grant tool authority.

Supabase OAuth compatibility is implementation readiness only. It does not prove that OAuth Server, dynamic client registration, asymmetric signing, an authorization/consent UI, OpenAI domain verification, or public OAuth environment configuration is active in production.


### Public MCP OAuth consent UI boundary

27. **OAuth authorization request -> Hercules consent page -> Supabase Auth OAuth server**: an untrusted OAuth client request reaches the owned consent UI with an `authorization_id`; the browser may display provider-validated client metadata and return the user's explicit approve/deny decision to Supabase Auth.

Controls: the route fails closed unless Supabase OAuth mode, origin, and publishable key are configured; browser code uses only the publishable key and never receives a service-role key, JWT signing secret, owner bearer token, or provider secret; the Supabase browser SDK is version-pinned; client name, redirect URI, scopes, and status are rendered with `textContent` rather than HTML injection; existing-account email sign-in sets `shouldCreateUser:false` so the consent surface cannot open public registration; authorization details are obtained from Supabase using the provider-issued `authorization_id`; approval and denial are explicit user actions; redirects are consumed only from Supabase Auth responses; the response is no-store and carries restrictive CSP, referrer, content-type, and frame protections. Enabling the OAuth Server, dynamic registration, production OAuth environment values, domain verification, or public plugin publication remains a separate owner/provider action.


### Supabase OAuth management boundary

28. **Hercules Deploy -> Supabase Management Auth config**: an explicitly authorized owner operation may enable the Supabase OAuth 2.1 server and dynamic client registration for the single allowlisted Hercules project.

Controls: the management token is environment-only and never placed in URLs or request bodies; project refs are format-validated and allowlisted; the operation refuses to run without an explicit authorization boolean; the desired mutation is fixed to `oauth_server_enabled=true`, `oauth_server_allow_dynamic_registration=true`, and `oauth_server_authorization_path=/oauth/consent`; the client reads before writing for idempotency and reads again after writing to verify provider state; redirects are rejected; the management base URL must be credential-free HTTPS; this boundary does not create users, approve OAuth consent, publish the plugin, or alter legal/domain-verification state.


### Studio benchmark execution boundary

29. **Studio caller -> owned preview cell -> benchmark renderer**: Studio forwards the caller's bearer token only to the fixed Hercules Supabase project, with redirects rejected. The preview cell validates the token with Auth and requires an active owner/admin membership before dispatch. Studio stores no caller credentials. Requests and upstream responses are bounded; upstream error details are suppressed. Only explicit benchmark mode can reach the existing constrained benchmark renderer; production requests never fall back to it. The registered benchmark capability is not proof of fresh provider availability or production readiness. Studio production start/resume remain gated independently.

The gateway has public read-only health at `/api/studio/video/status` and authenticated benchmark dispatch at `/api/studio/video/benchmark`. The latter accepts the canonical preview-cell video request envelope, forces benchmark mode, and requires an existing owner/admin Supabase access token. No service-role token or owner-token bypass is introduced. The external benchmark renderer and its artifact validation/storage remain governed by the existing preview-cell boundary.
