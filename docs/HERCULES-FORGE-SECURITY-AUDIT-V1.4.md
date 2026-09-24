# Hercules Forge Security Audit Events v1.4

## Purpose

v1.4 adds an owned, tamper-evident security/audit event boundary to Hercules Forge.

The audit layer records authenticated and privileged state changes server-side. It does not trust the customer console to decide what happened, and it does not record passwords, bearer credentials, session cookies, CSRF values, control tokens, or interpreter tokens.

## Storage

Audit events are stored under the configured Forge root:

```text
audit/events.jsonl
```

The file is append-only from the Forge audit API.

Each event contains:

- schema version
- strict monotonic sequence number
- UTC timestamp
- event type
- outcome: `success`, `failure`, or `blocked`
- actor kind: `user`, `control`, or `system`
- optional user ID
- optional workspace ID
- optional project ID
- bounded JSON details
- previous-event hash
- current-event SHA-256 hash

## Tamper-evident chain

Before a new event is appended, Forge verifies the existing log from the first record through the last.

Verification checks:

- valid JSON on every line
- supported audit version
- continuous sequence numbers
- valid timestamps
- allowed event types/outcomes
- safe actor/workspace/project identifiers
- secret-field exclusion
- exact previous-hash linkage
- exact event hash

If an existing audit event is modified, removed from the middle, reordered, or contains an invalid hash link, verification fails and subsequent audited writes fail closed.

The local adapter serializes append operations through one process-level queue so concurrent actions in the Forge process cannot create duplicate sequence numbers.

## Secret exclusion

Audit detail objects reject field names that look like credential material, including names containing:

- password
- token
- secret
- authorization
- cookie
- csrf

Authentication failures use a SHA-256 hash of the normalized email string rather than the raw email in the audit details.

That hash is a pseudonymous correlation value, not an anonymity guarantee.

## Authentication events

Forge records:

- successful customer sign-in
- invalid-credential sign-in failure
- rate-limited sign-in block
- customer logout

Failed and blocked sign-ins use a `system` actor because no authenticated user identity has been established.

Successful sign-in/logout events use the authenticated Forge user ID.

## Privileged mutation events

Customer/workspace actions record:

- project creation
- project revision
- preview start/stop
- runtime-data snapshot creation
- runtime-data restore
- publish
- rollback

Owner control-token actions record:

- user provisioning
- workspace provisioning
- workspace membership addition
- project creation
- revision creation
- artifact build
- preview start/stop
- snapshot creation
- restore
- publish
- rollback

Audit details contain only the identifiers needed to reconstruct what changed, such as revision, release, snapshot, or artifact fingerprint.

## Audit API

Owner control-token routes:

- `GET /v1/audit/verify`
- `GET /v1/audit?limit=100&workspaceId=...&projectId=...&type=...`

The verify route returns full chain-integrity metadata.

Workspace owners/admins can read their scoped history through:

- `GET /v1/workspaces/:workspaceId/audit`

Optional query parameters:

- `limit`
- `projectId`
- `type`

Workspace audit access is denied to builders/viewers even though those roles may perform some non-administrative project actions.

## Builder Console

The customer Builder Console shows a Security audit panel to workspace owners/admins.

It displays:

- chain verification state
- event type
- timestamp
- outcome
- actor identity/kind

When a project is selected, the audit panel automatically scopes to that project.

## Staging proof

The Forge staging restart drill now also verifies:

1. Forge reports audit capability;
2. synthetic project creation produces an audit event;
3. verified data snapshot creation produces an audit event;
4. the Forge container restarts;
5. the audit chain still verifies;
6. the project audit event still exists;
7. the snapshot audit event still exists.

The evidence artifact records the audit persistence result but never records the control token.

## Current boundary

v1.4 is a single-process, filesystem-backed tamper-evident audit chain.

It is not yet:

- a multi-writer distributed audit ledger
- an external immutable/WORM archive
- a SIEM pipeline
- a cross-region replicated security log
- a cryptographically signed third-party timestamp service

Those can be added later behind a replaceable audit adapter without changing the server-side event vocabulary.

## Owned-code boundary

The v1.4 audit store and API integration are repository-controlled Hercules Forge source. They use only local Hercules modules and Node.js built-ins.

The owner-code gate covers `hercules-forge/audit.mjs`, and the staging proof remains on the explicitly declared external Docker infrastructure boundary.
