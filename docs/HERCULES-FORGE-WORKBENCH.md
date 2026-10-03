# Hercules Forge Workbench

## Purpose

This milestone turns the existing Hercules Forge customer console into an IDE-grade workbench without replacing the owned Forge compiler, immutable revision model, artifact verification, preview runtime, release controls, workspace authorization, audit chain, or rollback path.

## Workbench surfaces

The customer console now presents one project workspace with:

- **Files** — a revision-indexed tree of generated source files.
- **Editor** — read-only, integrity-checked source inspection. Direct silent file mutation is intentionally not introduced; changes continue through new immutable Forge revisions.
- **Live preview** — start, stop, and open the isolated preview for a selected immutable revision.
- **Hercules Agent** — prompt-driven revision creation through the existing replaceable interpreter boundary.
- **Proof Gate** — visible checks for immutable revision identity, source indexing, build fingerprint, and ownership attestation before the user proceeds toward artifact/release validation.
- **Terminal / Output** — a bounded browser activity stream for Forge actions and API outcomes, not a privileged host shell.
- **Build Ledger** — immutable revision history with fingerprints, file counts, preview actions, publish actions, and rollback controls according to workspace role.

## Source browser boundary

Forge source browsing is not an arbitrary filesystem reader.

A source request must:

1. identify an existing project and immutable revision;
2. name a file that already exists in the revision's generated-source index;
3. pass path normalization that rejects absolute paths, backslashes, empty segments, dot segments, traversal, and NUL content;
4. remain below the browser source-size limit;
5. match the indexed byte count and SHA-256 digest before content is returned.

Customer requests remain workspace-scoped and session-authorized. Operator requests remain control-token authorized.

## Why the editor is read-only

Forge preserves a stronger provenance model by requiring user changes to become explicit new revisions. The workbench can inspect generated source, but it does not silently mutate files in place. Prompt-driven or future structured editing can produce a new revision, preserving the ledger, diff, proof, artifact, release, and rollback chain.

## Hercules differentiators

### Proof Gate

The workbench exposes evidence before release actions instead of using cosmetic success indicators. Artifact and release verification remain server-side enforcement points.

### Build Ledger

Revision history is treated as an operational ledger: each revision retains its fingerprint, generated source index, timestamp, message, and ownership evidence, with release and rollback actions layered on top.

## Security notes

- Source content is returned only from the immutable revision index.
- The source endpoint verifies bytes and SHA-256 before returning content.
- Customer workspace authorization is rechecked server-side for source reads.
- The browser editor is not a privileged shell.
- Existing CSRF requirements remain in force for state-changing customer operations.
- Existing role gates still restrict publish, rollback, audit, and restore operations.

## Compatibility

The workbench uses the existing Hercules Forge v1 API family. Existing project, revision, preview, artifact, release, runtime-data, identity, and audit behaviors remain intact.
