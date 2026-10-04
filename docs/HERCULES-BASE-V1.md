# Hercules Base v1

Hercules Base is the SauceApproved backend operating system.

It is not a fork or renamed distribution of Supabase. Hercules Base owns the
control logic that turns backend intent into a governed, portable runtime plan.
The initial self-hosted data plane uses declared external infrastructure:
PostgreSQL, PostgREST, Docker, and Node.js.

## What makes it different

### Blueprint Engine

A caller describes the backend it wants:

- project name and stable slug;
- environment;
- single-tenant or multi-tenant isolation;
- data classes;
- requested backend capabilities.

Hercules Base compiles that intent into a deterministic machine-readable
blueprint. The same normalized intent produces the same project identifier.

### Guardian

Security requirements are compiled with the backend instead of being optional
cleanup work.

Guardian v1 includes:

- RLS required;
- ownership predicates for multi-tenant projects;
- UPDATE `WITH CHECK` requirement;
- audit requirement;
- backups and restore verification;
- no public database ports;
- fail-closed migrations;
- stronger secret controls when sensitive data is declared.

Guardian does not claim that generating a rule proves every deployed backend is
secure. Deployment evidence must prove that the rule was applied.

### Portability Capsule

Every compiled blueprint declares its escape path:

- no allowed vendor-lock-in requirement;
- PostgreSQL custom-format export;
- SQL export;
- schema and migration artifacts;
- policy manifest;
- runtime manifest;
- backup;
- restore-verification evidence.

This makes portability a build property instead of a future migration project.

### Recommendation Engine

Hercules Base includes an owned recommendation engine for ranking software
resources against explicit task signals.

Version 1:

- accepts a task query plus explicit signals such as `shopify`, `security`,
  `typescript`, or `api`;
- ranks internal modules, libraries, security controls, documentation,
  workflows, services, and tools;
- filters resources by caller-authorized scope before ranking;
- suppresses resources the caller already knows about;
- favors owned and reviewed resources over unreviewed observations;
- returns deterministic scores and short explanations;
- emits only bounded result fields and does not echo arbitrary resource
  metadata or credential-shaped fields;
- has no dependency on the historical GitHub Recommender System dataset.

The engine is intentionally local and deterministic in v1. External discovery
providers can be added later as adapters, but provider access does not grant
additional Hercules permissions.

## Current capability state

Implemented and evidenced:

- Hercules Base Sparks control plane for owner-scoped function manifests, deterministic fingerprints, bounded resource/network policy, and explicit fail-closed invocation while isolated execution remains unavailable;
- Hercules Base Pulse realtime with durable PostgreSQL event replay, JWT-owned channels, cursor polling, consumer-backpressured SSE streaming, cancellation propagation, and no Supabase Realtime dependency;
- Hercules Base Storage with content-addressed SHA-256 blobs, private JWT-owned buckets and objects, PostgreSQL metadata, persistent self-hosted storage, and download-time integrity verification;
- Hercules Base Auth with scrypt password hashing, JWT access tokens, rotating opaque refresh tokens, server-only credential/session RPCs, and fixture-only staging identities;
- PostgreSQL database substrate in isolated Hercules staging;
- PostgREST data API substrate;
- Blueprint Engine;
- Guardian policy compiler;
- Portability Capsule;
- Recommendation Engine;
- authenticated Hercules Base control API;
- staging backup/restore verification inherited from the existing staging plane.

Planned, not represented as complete:

- Hercules Base Functions execution: Sparks registration/control is implemented, but arbitrary function execution remains blocked until a hardened isolated executor is built and benchmarked;
- multi-project provisioning onto deployment targets;
- production migration/cutover from managed Supabase.

## Control API

Public:

- `GET /health`
- `GET /v1/capabilities`

Control-token protected:

- `POST /v1/blueprints/compile`
- `POST /v1/recommendations`

Authenticated user storage:

- `POST /v1/storage/buckets`
- `PUT|GET|DELETE /v1/storage/objects/{bucket}/{key}`
- `GET /v1/storage/objects/{bucket}`

Recommendation requests are bounded, validated, scope-filtered, and return only
the normalized recommendation result surface.

## Self-hosted staging

The existing `staging-plane/compose.yml` now starts Hercules Base beside
PostgreSQL and PostgREST.

The Base source is mounted read-only:

`../hercules-base:/repo/hercules-base:ro`

The control service is loopback-bound at port `38800`.

This is staging evidence only. It does not establish production-scale
availability or complete Supabase replacement parity.

## Ownership boundary

Owned Hercules source:

- `hercules-base/core.mjs`
- `hercules-base/recommender.mjs`
- `hercules-base/storage-core.mjs`
- `hercules-base/storage-router.mjs`
- `hercules-base/storage-store.mjs`
- `hercules-base/realtime-core.mjs`
- `hercules-base/realtime-router.mjs`
- `hercules-base/realtime-store.mjs`
- `hercules-base/response-bridge.mjs`
- `hercules-base/router.mjs`
- `hercules-base/server.mjs`
- Hercules Base tests, docs, policy logic, and future owned control software.

External infrastructure:

- PostgreSQL;
- PostgREST;
- Docker;
- Node.js;
- Supabase while legacy Hercules workloads still depend on it.

Hercules Base can progressively replace managed Supabase dependencies without
claiming ownership over the external infrastructure underneath the platform.
