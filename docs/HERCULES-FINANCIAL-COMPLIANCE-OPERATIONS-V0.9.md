# Hercules Financial Compliance Operations v0.9

Date: 2026-09-27

## Purpose

v0.9 turns the v0.8 regulated-money readiness model into an operational owner surface
without enabling live funds movement.

It adds:

- durable compliance-evidence records;
- tamper-evident compliance event history;
- bounded regulated-provider metadata;
- KYC/AML/sanctions provider interface validation;
- reconciliation operations that persist summaries rather than raw provider records;
- owner-only compliance API routes;
- a read-only readiness section in the owner console;
- automatic startup of compliance state with the one-command Financial service.

## Data minimization

The compliance state intentionally does not persist:

- KYC document images;
- Social Security numbers;
- government-ID numbers;
- bank credentials;
- provider API keys;
- provider access tokens;
- raw reconciliation datasets.

Evidence records contain only control name, review status, reference identifier, review
timestamp, and authenticated actor identifier.

Provider profiles contain only contract-facing metadata: provider ID, environment,
endpoint, and declared capabilities.

Reconciliation state stores only a run identifier, actor, timestamp, result, and exception
counts.

## Integrity

Every durable compliance mutation becomes a sequence-numbered SHA-256 event chained to
the previous event hash. Restore verifies:

- exact event shape;
- sequence order;
- previous-hash continuity;
- event hash;
- replayed evidence state;
- replayed provider state;
- replayed reconciliation summaries;
- snapshot head hash.

The state file uses same-directory temporary-file replacement and mode 0600 for temporary
files.

## Owner API

All routes require an approved administrator role. Cookie-authenticated mutations also
retain the existing CSRF requirement.

- GET /v1/admin/compliance
- POST /v1/admin/compliance/evidence
- POST /v1/admin/compliance/provider
- POST /v1/admin/compliance/reconciliation

Authenticated actor identity is taken from the verified Hercules Base subject, not from
request-body actor fields.

## KYC/AML provider boundary

validateComplianceProviderAdapter() defines a narrow adapter contract:

- verifyCustomer
- screenSanctions
- assessTransaction

Production provider endpoints require HTTPS. The adapter contract does not bundle a
vendor, credentials, or provider implementation and does not claim that any particular
provider satisfies regulatory obligations.

## Live money

v0.9 does not change the v0.8 execution rule:

- readiness may become green;
- executionEnabled remains false;
- HerculesRegulatedRailBoundary.executeTransfer() remains hard-locked;
- the owner console has no live-money activation control.

Real-money activation remains a later owner-approved, legally reviewed, provider-backed
release.
