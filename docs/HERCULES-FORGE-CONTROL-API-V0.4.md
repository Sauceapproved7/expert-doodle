# Hercules Forge Control API v0.4

## Purpose

v0.4 turns the owned Forge compiler, workspace, artifact, and release layers into a self-hostable control service.

The service is implemented with Node.js standard-library primitives and does not require a hosted app-builder runtime.

## API surface

- GET /health
- POST /v1/projects
- GET /v1/projects/:projectId
- GET /v1/projects/:projectId/revisions
- POST /v1/projects/:projectId/revisions
- GET /v1/projects/:projectId/revisions/:revisionId
- POST /v1/projects/:projectId/revisions/:revisionId/artifact
- POST /v1/projects/:projectId/publish
- GET /v1/projects/:projectId/releases/active
- POST /v1/projects/:projectId/rollback

Publish builds and verifies the artifact internally before creating a release record. The explicit artifact route lets an operator or future UI produce and inspect the exact verified deployable bundle before publication.

## Security defaults

- Mutating and project-data routes require a bearer control token.
- Bearer-token equality is checked with a constant-time comparison after length validation.
- The CLI binds to 127.0.0.1 by default.
- Request bodies are capped at 1 MiB.
- Project and revision identifiers must be path-safe in both workspace and artifact layers.
- Project creation fails if the project directory already exists.
- Revision creation fails if a revision ID already exists, making revision records immutable by construction.
- Unexpected internal failures return a generic internal_error response instead of exposing internal error text.

The control token is an operator credential. Production deployments should inject it as FORGE_CONTROL_TOKEN through the runtime secret system rather than commit it.

## Run

    FORGE_CONTROL_TOKEN=<secret> node hercules-forge/control-cli.mjs

Optional:

    FORGE_ROOT=.hercules-forge
    FORGE_HOST=127.0.0.1
    FORGE_PORT=38700

If FORGE_CONTROL_TOKEN is omitted, the CLI generates a random token and prints it once for local development.

## Ownership boundary

The HTTP routing, workspace operations, build admission, artifact verification, release records, and rollback behavior are Hercules Forge source code in the canonical repository.

A future customer-facing UI or model interpreter should call this control API rather than bypassing it or handing canonical project state to a hosted builder.
