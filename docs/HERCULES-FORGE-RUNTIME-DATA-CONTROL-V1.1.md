# Hercules Forge Runtime Data Control v1.1

## Purpose

v1.1 turns the v1.0 persistent runtime store into an operable data layer with explicit quotas, verified snapshots, atomic restore, and a replaceable runtime-data adapter contract.

Generated applications keep the same CRUD API. Storage policy and backup/restore move behind Forge-owned data-control interfaces.

## Runtime data adapter

Forge now exports:

- `ForgeRuntimeDataAdapter`
- `ForgeLocalRuntimeDataAdapter`
- `DEFAULT_RUNTIME_DATA_MAX_BYTES`

The local adapter owns:

- project usage accounting
- project byte quotas
- snapshot creation
- snapshot listing
- snapshot hash verification
- snapshot fingerprint verification
- atomic restore

The adapter contract allows a later transactional database backend to replace the local engine without changing the customer Builder Console or generated app CRUD surface.

## Project quota

The default project quota is 50 MiB.

The trusted preview manager injects:

- `FORGE_DATA_DIR`
- `FORGE_DATA_MAX_BYTES`

Generated runtime code does not accept either value from customer HTTP requests.

All runtime mutations serialize through one project-level mutation queue before quota calculation and write. This prevents writes to different entities from racing past a shared project limit.

If the next write would exceed the quota, the generated app returns HTTP 413 with `runtime data quota exceeded` and does not commit the mutation.

## Verified snapshots

Snapshots are stored under:

`runtime-snapshots/<projectId>/<snapshotId>/`

Each snapshot contains:

- copied JSON entity files
- per-file SHA-256 hashes
- per-file byte counts
- total byte count
- project and snapshot identity
- a deterministic snapshot fingerprint

Verification fails closed for:

- identity mismatch
- unsafe file names
- missing files
- unexpected extra files
- content hash mismatch
- byte-count mismatch
- fingerprint mismatch

## Restore behavior

Restore verifies the snapshot before touching active data.

The local restore flow:

1. copies the verified snapshot into a temporary runtime directory;
2. moves the current project data aside;
3. atomically activates the restored directory;
4. removes the previous directory only after activation succeeds;
5. preserves the previous directory if activation rollback itself fails.

A snapshot larger than the currently configured project quota cannot be restored.

## API

Owner control-token routes:

- `GET /v1/projects/:projectId/data/usage`
- `GET /v1/projects/:projectId/data/snapshots`
- `GET /v1/projects/:projectId/data/snapshots/:snapshotId`
- `POST /v1/projects/:projectId/data/snapshots`
- `POST /v1/projects/:projectId/data/snapshots/:snapshotId/restore`

Customer workspace routes:

- `GET /v1/workspaces/:workspaceId/projects/:projectId/data/usage`
- `GET /v1/workspaces/:workspaceId/projects/:projectId/data/snapshots`
- `GET /v1/workspaces/:workspaceId/projects/:projectId/data/snapshots/:snapshotId`
- `POST /v1/workspaces/:workspaceId/projects/:projectId/data/snapshots`
- `POST /v1/workspaces/:workspaceId/projects/:projectId/data/snapshots/:snapshotId/restore`

Snapshot creation requires owner, admin, or builder membership. Restore requires owner or admin membership. Read-only usage and snapshot inspection are available to any workspace member with project access.

Snapshot and restore operations stop an active preview before touching data so the filesystem image is consistent.

## Customer console

The customer Builder Console now shows:

- current runtime-data usage
- configured project limit
- data-file count
- verified snapshot history
- Create snapshot for builder/admin/owner
- Restore for admin/owner

Restore requires an explicit browser confirmation because it replaces current runtime data.

## Security and integrity

- Runtime data remains outside verified source artifacts.
- Snapshot IDs and project IDs are path-safe.
- Snapshot contents are hash verified.
- Unexpected snapshot files fail verification.
- Preview credentials remain stripped.
- Customer workspace membership and project binding remain enforced.
- Restore is role restricted and CSRF protected.
- Owner-code-only runtime/provenance gates cover the new adapter.

## Current scale boundary

The local runtime engine is still single-process and filesystem-backed. v1.1 makes that engine controllable and recoverable, but it is not a distributed transactional database.

The next database milestone can implement the same adapter contract with PostgreSQL or another owned transactional backend, adding migrations, row-level data authorization, backup retention, replication, and production failover without changing generated application APIs.
