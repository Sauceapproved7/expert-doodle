# Hercules Forge Persistent Runtime v1.0

## Purpose

v1.0 replaces generated app preview data that previously lived only in memory with an owned persistent runtime store.

Source artifacts remain immutable and verifiable. Runtime data lives outside the verified bundle so app revisions can change without erasing customer records or invalidating artifact hashes.

## Generated runtime

Every newly compiled Forge app now includes:

- `server.mjs`
- `runtime-store.mjs`
- `forge.manifest.json`
- SQL migration source
- generated browser UI assets

The generated server uses `ForgeRuntimeStore` from the generated owned `runtime-store.mjs` file.

## Persistence behavior

The runtime store:

- uses one durable JSON file per entity
- writes through a temporary file and atomic rename
- rejects unknown entity names
- preserves generated record IDs and timestamps
- persists create, update, and delete operations
- survives process restart
- survives Forge source revision changes for the same project

The default generated runtime writes to `.forge-data` when no explicit data directory is provided.

## Preview data boundary

Forge preview explicitly supplies:

`FORGE_DATA_DIR=<forge-root>/runtime-data/<projectId>`

That directory is outside:

`artifacts/<projectId>/<revisionId>/bundle`

This means:

1. artifact verification continues to cover immutable source only;
2. runtime records are not treated as source code;
3. rebuilding or changing revisions does not wipe project data;
4. data is shared across preview revisions for the same project;
5. project data remains isolated by project ID.

## Current scale boundary

The v1.0 runtime store is a durable single-process local data engine. It is suitable for Forge preview, local deployments, development, demonstrations, and the first owned persistence boundary.

It is not yet the final distributed database layer. Multi-instance production deployments still require the next adapter layer for transactional database backends, backups, replication, migrations, quotas, and row-level authorization.

The emitted SQL migration remains available as the schema contract for that next database adapter.

## Security properties

- Generated entity names are schema-validated and path-safe.
- Runtime data is never written into the verified artifact bundle.
- Preview still strips control/model credentials before launching generated code.
- `FORGE_DATA_DIR` is injected by the trusted preview manager, not accepted from customer HTTP input.
- Owner-code-only compiler and artifact provenance enforcement remains active.

## Verification

Automated tests cover:

- generated persistent runtime source
- explicit preview data-directory injection
- credential stripping
- persistence across preview stop/start
- persistence across source revision changes
- existing CRUD, artifact, workspace, session, provenance, and release behavior

## Next database layer

The next persistence milestone can replace or supplement the local runtime store with an owned database adapter while keeping the generated CRUD contract stable. The adapter boundary should preserve project/workspace isolation, migrations, backup/restore, and fail-closed authorization.
