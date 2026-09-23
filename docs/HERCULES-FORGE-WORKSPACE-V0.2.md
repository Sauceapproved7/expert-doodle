# Hercules Forge Workspace v0.2

## Scope

v0.2 adds the first owned project-state and release layer on top of the v0.1 compiler.

Hercules Forge now owns:

- project records
- generated source snapshots
- immutable revision records
- file hashes
- revision diffs
- active release records
- rollback selection
- the deployment adapter contract

## Workspace layout

A Forge workspace uses an explicit filesystem structure:

    projects/<project-id>/project.json
    projects/<project-id>/latest-revision.json
    projects/<project-id>/revisions/<revision-id>/revision.json
    projects/<project-id>/revisions/<revision-id>/source/...
    releases/<project-id>/<revision-id>.json
    releases/<project-id>/active.json

Generated source is retained for each revision rather than being hidden inside a hosted builder.

## Deployment boundary

The local release adapter is intentionally simple. It records the active revision and rollback history without requiring any external deployment service.

Production hosting integrations must implement ForgeDeploymentAdapter. They may transport or run a revision, but they must not become the canonical source of project state.

## Ownership and third-party boundary

This source-controlled orchestration, workspace format, revision model, and release contract are Hercules Forge product code.

Node.js, operating systems, databases, model services, cloud providers, and other infrastructure retain their own licenses and rights. Provider adapters remain replaceable.

## Next increment

The next Forge increment should add a sandbox build/preview runner and a deployable artifact bundle that is verified against the revision fingerprint before publication.
