# Hercules SmokeScreen Sentinel v2 — Mirage Fabric

Status: v2 implementation candidate  
Scope: defensive deception and containment inside authorized Hercules infrastructure  
Runtime: `hercules-runtime/smokescreen-agent.mjs`  
Document path retained for continuity with v1.

## Purpose

SmokeScreen Sentinel watches normalized Hercules security telemetry and turns suspicious behavior into bounded defensive responses. It is designed to increase attacker uncertainty and dwell-time cost while keeping real systems, credentials, customer data, and production authority outside the deception plane.

SmokeScreen does not attack, scan, exploit, access, or alter an external system. Every action is constrained to infrastructure SauceApproved/Hercules owns or is explicitly authorized to operate.

## Architecture

1. **Sensor feed** — an authorized edge, API, auth, or runtime adapter emits normalized events.
2. **Decision engine** — the Sentinel scores bounded signals and produces one of four dispositions:
   - `OBSERVE`
   - `THROTTLE`
   - `QUARANTINE`
   - `CONTAIN`
3. **SmokeScreen response plan** — abstract actions tell an owned adapter what defensive control to apply.
4. **Decoy plane** — high-risk sessions can be routed to isolated fake surfaces identified by HMAC-derived decoy IDs. Decoys must never contain real credentials or customer data.
5. **Honeytoken plane** — decoy sessions may receive traceable tokens that are valid only as detection markers.
6. **Audit chain** — every observed event produces a tamper-evident HMAC chain record plus a checkpointable head hash.
7. **Watcher loop** — `runSmokeScreenWatcher` consumes an async telemetry stream and emits decisions continuously.

## Defensive actions

Current abstract actions are intentionally local-only:

- `LOG`
- `TARPIT`
- `RATE_LIMIT`
- `DECOY_ROUTE`
- `ISSUE_HONEYTOKEN`
- `ISOLATE_SESSION`
- `ROTATE_HONEYTOKENS`
- `EVIDENCE_CAPTURE`

The engine has no outbound counterattack capability.

## Safety and containment invariants

- `scope` is always `OWNED_INFRASTRUCTURE_ONLY`.
- `outboundCounterattack` is always `false`.
- Tarpit delay is bounded to 1500 ms.
- Event fields are size-bounded and unsupported signals fail closed.
- HMAC keys must be at least 32 bytes and remain server-side.
- Raw session IDs are not emitted in decisions.
- Decoy identifiers are deterministic HMAC fingerprints, not bearer secrets.
- The audit trail is tamper-evident; retained-window pruning preserves the prior chain hash as an anchor.
- Decision output has no execution authority. A separate authorized local adapter must translate abstract actions into infrastructure controls.
- Decoy routes must be isolated from real databases, secrets, payment systems, signing keys, production administrative APIs, and customer data.

## Signal contract

Supported numeric signals:

- `authFailures`
- `routeProbes`
- `requestVelocity`
- `signatureMismatches`

Supported boolean signals:

- `enumerationPattern`
- `honeytokenTouched`
- `credentialStuffing`
- `impossibleSequence`
- `privilegeBoundaryProbe`

A honeytoken touch is treated as a critical signal and produces immediate containment guidance.

## Hercules integration

The unified command surface exposes:

`security.smokescreen -> hercules-runtime`

The route preserves `executionAuthority=false`. The Sentinel therefore decides and records; it does not independently gain permission to revoke accounts, modify provider configuration, or take any external action.

Production adapters should map decisions to existing authorized controls at the nearest ingress boundary. A typical sequence is:

`edge/auth telemetry -> SmokeScreen watcher -> decision -> local enforcement adapter -> isolated decoy or real route`

## Deployment modes

Recommended rollout:

1. **Observe-only** — feed production telemetry but execute only `LOG` and evidence capture.
2. **Bounded friction** — enable `TARPIT` and `RATE_LIMIT`.
3. **Deception** — enable isolated `DECOY_ROUTE` and honeytokens after false-positive review.
4. **Containment** — enable session isolation only at trusted local enforcement points with rollback evidence.

The runtime core can support all four modes, but deployment adapters must be enabled deliberately per environment.

## Ownership and provenance

The SmokeScreen Sentinel runtime, tests, command-surface integration, and this specification are project-authored Hercules source created for SauceApproved on 2026-09-28. The implementation uses only Node.js built-ins and repository-owned source. Node.js and GitHub Actions remain third-party infrastructure and are not claimed as SauceApproved-owned code.


## Mirage Fabric v2

v2 upgrades the decoy plane from a static destination into an adaptive synthetic environment.

For every high-confidence decoy decision, SmokeScreen can generate a short-lived Mirage Fabric with:

- a deterministic but rotating synthetic namespace;
- synthetic-only API, operations, and storage routes;
- session-scoped honeytokens that are never valid credentials;
- bounded synthetic record counts;
- explicit `ISOLATED_NO_EGRESS` network policy;
- explicit `SYNTHETIC_ONLY` data policy;
- `realAssetAccess=false`;
- `executionAuthority=false`;
- `outboundCounterattack=false`; and
- a fail-closed `DENY` fallback if required isolation cannot be proven.

The topology can evolve across generations as the hostile session changes behavior. Attacker-controlled labels are not reflected directly into route names or namespaces; unrecognized focus values collapse to a bounded `generic` profile.

### v2 local enforcement contract

`createSmokeScreenEnforcementPlan(decision)` converts a decision into a bounded local plan. A decoy plan requires:

- `NO_EGRESS`
- `NO_PRODUCTION_CREDENTIALS`
- `NO_CUSTOMER_DATA`
- `NO_PAYMENT_KEYS`
- `NO_SIGNING_AUTHORITY`

If an enforcement adapter cannot prove those controls, it must deny the hostile session rather than route it back to real assets.

### v2 runtime API

- `createMirageFabric(decision, context, options)`
- `evolveMirageFabric(fabric, observation, options)`
- `createSmokeScreenEnforcementPlan(decision)`

The agent instance also exposes `plan()`, `mirage()`, and `evolveMirage()` helpers bound to its server-side HMAC key and clock.


## Forge production observe-only ingress

Forge production now boots SmokeScreen Sentinel automatically in `OBSERVE_ONLY` mode at the HTTP control boundary.

The ingress adapter:

- observes completed Forge responses without changing status, body, routing, or session behavior;
- hashes network/client identity before exposing observation results;
- accumulates bounded per-client request-window signals for auth failures, denied privileged paths, route probes, velocity, and signature mismatch indicators;
- feeds only normalized signals into the existing SmokeScreen Sentinel;
- applies no rate limit, tarpit, decoy route, or containment action in this phase;
- keeps `outboundCounterattack=false`;
- exposes public capability status only through `/health`;
- exposes aggregate observation evidence only through the bearer-protected `GET /v1/security/smokescreen` operator route.

Production derives the SmokeScreen HMAC key from the existing Forge control-secret boundary using a namespaced HMAC derivation. No new secret is committed or returned by health/metrics surfaces.

Promotion beyond observe-only requires separate false-positive evidence and a new reviewed enforcement change.
