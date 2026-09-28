# Hercules Forge Durable State v1

## Purpose

Forge keeps local filesystem materialization for compilation, artifact creation, previews, and fast runtime access, but production can use the Hercules private bridge plus Supabase as the authoritative restart-safe state layer.

## State covered

The durable mirror includes only these Forge-owned state roots:

- projects
- identity
- audit
- runtime-data
- runtime-snapshots
- releases

Artifacts are deliberately excluded because they can be deterministically rebuilt from immutable verified revisions.

## Startup and shutdown

With `FORGE_DURABLE_STATE_URL` and `FORGE_DURABLE_STATE_TOKEN` configured:

1. production verifies the remote durable-state service identity;
2. the local Forge root is hydrated and every object is SHA-256 verified before the HTTP server starts;
3. state-changing control-plane responses are not acknowledged until the mirror flush succeeds;
4. successful preview CRUD writes cross the same persistence barrier;
5. shutdown flushes before and after the HTTP server closes.

Production fails closed if remote status, authentication, object integrity, or manifest verification fails.

## Remote protocol

The private bridge owns six namespaced actions:

- `forge_state_status`
- `forge_state_manifest`
- `forge_state_put_chunk`
- `forge_state_commit_object`
- `forge_state_get_chunk`
- `forge_state_delete_object`

The protocol is not a general database, SQL, shell, or filesystem API.

## Integrity model

Objects are split into bounded chunks. Every chunk carries its own SHA-256. Chunks are also bound to a complete-object SHA-256 generation.

A replacement object is committed only after the bridge:

- verifies every expected chunk exists;
- decodes and re-verifies each chunk digest;
- validates the full byte count;
- reassembles the object;
- validates the full-object SHA-256.

Only after that proof does the object manifest move to the new generation. Old committed chunks remain readable during an interrupted replacement upload.

## Database boundary

State tables use RLS, revoke access from `public`, `anon`, and `authenticated`, and grant the server-side `service_role` only the required CRUD privileges.

The Forge durable-state service key is stored in Supabase Vault. The internal service-key registry stores only the SHA-256 digest and Vault reference.

## Public deployment proof

A Forge public deployment is not certifiable unless:

- Forge health reports durable state enabled;
- readiness proves the durable-state service is reachable;
- the durable-state schema identity matches;
- the durable-state response declares that it carries no credentials;
- local working storage and the Forge audit chain are also verified.

## Single-writer boundary

v1 assumes one active Forge control-plane writer for a given durable-state namespace. Horizontal multi-writer conflict resolution is a later phase and is not implied by this milestone.
