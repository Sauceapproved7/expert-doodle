# Hercules Forge Control API v0.4

## Scope

v0.4 exposes the owned Forge workflow through an operator API implemented with Node core modules.

It does not introduce a hosted app-builder backend.

## Security boundary

The control API fails closed unless an operator token exists.

All v1 project, revision, artifact, release, and rollback routes require:

    Authorization: Bearer <FORGE_OPERATOR_TOKEN>

The health endpoint is intentionally unauthenticated.

The server binds to loopback by default in control-server.mjs.

## Owned operations

The API supports:

- create project
- read project
- list revisions
- create revision
- read revision
- build verified artifact
- publish a verified revision
- inspect the active release
- rollback to a previously verified release

## Routes

    GET  /health
    POST /v1/projects
    GET  /v1/projects/:projectId
    GET  /v1/projects/:projectId/revisions
    POST /v1/projects/:projectId/revisions
    GET  /v1/projects/:projectId/revisions/:revisionId
    POST /v1/projects/:projectId/revisions/:revisionId/artifact
    POST /v1/projects/:projectId/revisions/:revisionId/publish
    GET  /v1/projects/:projectId/releases/active
    POST /v1/projects/:projectId/releases/:revisionId/rollback

## Local launch

    FORGE_OPERATOR_TOKEN=<secret> node hercules-forge/control-server.mjs

Optional:

    FORGE_WORKSPACE_ROOT=/path/to/workspace
    PORT=4080

## Ownership boundary

The control API, route contract, authentication gate, workspace orchestration, artifact admission, and release transitions are canonical Hercules Forge source.

AI models, cloud hosts, databases, and infrastructure remain replaceable components behind explicit boundaries. They do not become the canonical builder.
