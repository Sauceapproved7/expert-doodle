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

## Current capability state

Implemented and evidenced:

- Hercules Base Storage with content-addressed blobs, private JWT-owned buckets, PostgreSQL metadata, and a portable filesystem adapter;

- Hercules Base Auth with scrypt password hashing, JWT access tokens, rotating opaque refresh tokens, server-only credential/session RPCs, and fixture-only staging identities;

- PostgreSQL database substrate in isolated Hercules staging;
- PostgREST data API substrate;
- Blueprint Engine;
- Guardian policy compiler;
- Portability Capsule;
- authenticated Hercules Base control API;
- staging backup/restore verification inherited from the existing staging plane.

Planned, not represented as complete:

- Hercules Base Realtime;
- Hercules Base Functions;
- multi-project provisioning onto deployment targets;
- production migration/cutover from managed Supabase.

## Control API

Public:

- `GET /health`
- `GET /v1/capabilities`

Control-token protected:

- `POST /v1/blueprints/compile`

Blueprint requests are bounded and validated. The response never contains the
control credential.

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
