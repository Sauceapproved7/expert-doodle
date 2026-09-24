# Hercules Forge Audit and Security Events v1.4

## Purpose

v1.4 adds an owned, durable security/audit event plane to Hercules Forge.

The audit plane records security-relevant authentication outcomes and state-changing Forge actions without storing passwords, bearer credentials, cookies, session tokens, CSRF values, or interpreter secrets.

This milestone extends the v1.2 production service and v1.3 staging proof. It does not add a third-party logging service or move canonical audit state outside Hercules.

## Audit store

Forge now exports:

- `ForgeAuditStore`

Audit records are stored under the configured Forge root:

```text
audit/events.jsonl
audit/head.json
```

`events.jsonl` is append-only from the Forge application perspective.

Each record contains:

- schema version
- monotonic sequence number
- timestamp
- event type
- outcome: `success`, `failure`, or `blocked`
- actor kind: `user`, `control`, or `system`
- optional user identity
- optional workspace identity
- optional project identity
- bounded, JSON-compatible, secret-free details
- previous event hash
- current event SHA-256 hash

## Integrity chain

Each event hash covers the complete normalized event payload plus the previous event hash.

Verification fails on:

- malformed JSON
- sequence gaps/reordering
- event version mismatch
- invalid event type/outcome
- invalid actor identity
- invalid workspace/project identity
- secret-shaped detail fields
- previous-hash mismatch
- event hash mismatch

Forge also writes an atomic audit-head checkpoint containing the last sequence and last hash.

The checkpoint detects accidental tail truncation when the event log no longer matches the retained head.

This is tamper-evident application storage, not an external hardware root of trust. An attacker with unrestricted write access to the complete Forge filesystem could rewrite both the log and checkpoint. A later production hardening milestone can anchor audit heads to independent storage or signed external evidence.

## Secret rejection

Audit detail keys are rejected if they resemble credential-bearing fields, including:

- password
- token
- secret
- authorization
- cookie
- CSRF

Authentication failures record only a normalized-email SHA-256 identifier and a bounded reason such as `invalid_credentials` or `rate_limit`.

Raw email passwords and request credentials are never copied into audit records.

## Authentication events

Forge records:

- `session.login` success
- `session.login` failure
- `session.login` blocked by rate limiting
- `session.logout`

Successful login records the authenticated user ID.

Failed/blocked login records use `system` actor plus the email hash rather than an unauthenticated user claim.

## Customer workspace events

Forge records workspace-scoped customer actions including:

- `project.create`
- `project.revision`
- `preview.start`
- `preview.stop`
- `data.snapshot`
- `data.restore`
- `project.publish`
- `project.rollback`

These records use the authenticated Forge user ID and canonical workspace/project IDs established by server-side authorization.

## Owner/operator events

The privileged owner control plane records:

- admin user creation
- workspace creation
- membership creation
- direct/prompt project creation
- direct/prompt revision creation
- verified artifact build
- preview start/stop
- runtime-data snapshot/restore
- publish
- rollback

Owner actions use actor kind `control`; the bearer token itself is never stored.

## Read and verification API

Owner control-token routes:

- `GET /v1/audit/verify`
- `GET /v1/audit?limit=&workspaceId=&projectId=&type=`

Workspace customer route:

- `GET /v1/workspaces/:workspaceId/audit?limit=&projectId=&type=`

Workspace audit access requires `owner` or `admin`.

Builders and viewers cannot read workspace audit history.

The workspace route always forces the authenticated workspace scope even if query parameters are supplied.

## Customer Builder Console

Workspace owners/admins now receive a Security audit panel in the customer Builder Console.

It shows:

- audit-chain verification state
- recent event type
- timestamp
- outcome
- actor identity

When a project is selected, audit retrieval is automatically project-scoped.

The panel does not render event credential material because those fields are rejected before persistence.

## Staging persistence proof

The existing Forge staging restart drill now verifies that, after restarting the Forge container:

- the audit capability remains enabled;
- the audit chain verifies;
- project-creation audit evidence is still present;
- snapshot audit evidence is still present.

The machine-readable staging evidence records these booleans without recording the control token.

## Failure behavior

Audit append is part of the state-changing request path.

If the audit chain is corrupted and a new event cannot be safely appended, the affected request fails closed rather than silently performing an unaudited action after the audit write point.

Some underlying state may already have been committed immediately before an audit-storage failure. v1.4 therefore provides tamper-evident application auditing, not a distributed transaction spanning every Forge state store. A future transactional backend can make mutation plus audit commit atomic.

## Ownership boundary

The following are repository-controlled Hercules Forge source:

- `hercules-forge/audit.mjs`
- audit integration in `hercules-forge/control-api.mjs`
- audit display in `hercules-forge/customer-console.mjs`
- audit persistence verification in the Forge staging drill

The implementation uses only owned local modules and Node.js built-ins.

No external logging SDK, hosted audit provider, package dependency, or credential collection service is introduced.
