# Hercules Forge Identity and Workspaces v0.8

## Purpose

v0.8 introduces the owned identity and multi-workspace authorization boundary required for customer-facing Hercules Forge use.

The existing operator control token remains available for owner/admin automation. Customer sessions use a separate identity system and never receive that privileged token.

## Identity storage

Forge now owns:

- user records
- normalized email indexes
- scrypt password hashes with random salts
- opaque random session tokens
- SHA-256 session-token storage keys
- CSRF token hashes
- workspace records
- workspace memberships and roles

Plaintext passwords and raw session tokens are not persisted.

## Session model

`POST /v1/session` authenticates an existing user and returns:

- an HttpOnly `forge_session` cookie
- a CSRF token for state-changing browser requests
- safe user/session metadata

Session cookies use `SameSite=Strict`. Production HTTPS deployments should start the control service with `secureSessionCookies: true` so the cookie also carries `Secure`.

`DELETE /v1/session` requires the session cookie plus `X-Forge-CSRF`.

## Workspace roles

Roles are intentionally small:

- `viewer`: inspect workspace projects and revisions
- `builder`: viewer access plus create/revise/preview
- `admin`: builder access plus publish/rollback
- `owner`: admin access and canonical workspace ownership

The customer API verifies both membership and project-to-workspace ownership before project-specific operations.

## Customer API

Session-scoped routes include:

- `GET /v1/me`
- `GET /v1/workspaces/:workspaceId`
- `GET /v1/workspaces/:workspaceId/projects`
- `POST /v1/workspaces/:workspaceId/projects/from-prompt`
- project inspection and revision listing
- prompt-driven revisions
- preview start/status/stop
- publish and rollback with admin/owner role enforcement

Projects created through customer routes receive canonical `workspaceId` and `createdByUserId` metadata from the authenticated session. Those values are not trusted from the request body.

## Operator provisioning API

The existing Forge control bearer token can provision the first customer identities and workspaces:

- `POST /v1/admin/users`
- `POST /v1/admin/workspaces`
- `POST /v1/admin/workspaces/:workspaceId/members`

These routes are intentionally separate from customer sessions.

## Security boundary

v0.8 is an application authorization foundation, not a complete public Internet edge. Before enabling unrestricted public registration, production deployment should add:

- TLS termination
- `secureSessionCookies: true`
- login/signup rate limiting
- abuse controls
- email verification and account recovery
- security event/audit logging
- production secret management
- hardened container/VM isolation for future arbitrary customer code

Forge preview remains the existing loopback controlled-process boundary and is not reclassified as a hardened sandbox.

## Owned-code boundary

The identity store, password/session handling, CSRF checks, workspace membership model, role enforcement, customer routes, project scoping, compiler, workspace/revision store, artifact verification, preview, release control, and Builder Console are repository-controlled Hercules Forge source.

External model providers remain replaceable interpreters and do not own Forge identity, authorization, project state, compiler output, deployment policy, or release state.
