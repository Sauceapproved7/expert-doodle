# Hercules Financial Production Readiness v1.0

Date: 2026-09-27

## Purpose

v1.0 adds a production-readiness proof layer for Hercules Financial. It defines the
technical and operational contracts that must be satisfied before a later release could
even be considered for real-money activation.

v1.0 does **not** activate external money movement.

The final readiness result always includes:

- `activationAllowed: false`
- `externalRailsEnabled: false`

## Production data boundary

`validateTransactionalFinancialStoreAdapter()` requires a production financial-data
backend to provide:

- atomic transaction execution;
- health checks;
- backup creation;
- restore verification.

This is an adapter contract only. The current sandbox JSON ledger is not re-labeled as a
production database, and no database credentials are added to the repository.

## Secret and key custody

`validateSecretCustodyAdapter()` requires:

- non-exportable signing;
- key metadata inspection;
- key rotation.

Adapters that expose functions such as `exportSecret`, `getSecret`, or `readSecret`
are rejected. The boundary is designed for an external KMS/HSM-style custody system
without embedding a vendor or credentials in Hercules owner code.

## Recovery proof

`validateRecoveryEvidence()` requires reviewed evidence for:

- a backup;
- a successful restore test;
- the restore-test timestamp;
- a reviewed RPO;
- a reviewed RTO.

Restore proof must be recent. The default maximum accepted restore-test age is 30 days.
RPO and RTO values are validated as positive bounded integer minutes.

This validates evidence. It does not claim that local JSON storage has become a
production disaster-recovery system.

## Financial case operations

`validateFinancialCaseOperations()` requires approved operational evidence for:

- fraud;
- disputes;
- returns;
- complaints;
- case retention.

The readiness object stores review metadata, not raw case PII.

## Provider onboarding certification

`certifyFinancialProviderOnboarding()` requires reviewed evidence for:

- provider authorization;
- regulatory scope;
- security review;
- data protection;
- audit rights;
- business continuity;
- incident escalation;
- reconciliation testing;
- exit planning.

A missing control produces a blocker rather than a partial certification.

## Composite production readiness

`evaluateFinancialProductionReadiness()` combines:

1. v0.8 regulated-money readiness;
2. transactional financial storage;
3. non-exportable secret/key custody;
4. recovery proof;
5. financial case operations;
6. provider onboarding certification.

Every component can be green while live money remains disabled.

A future activation release would require a separate, explicit architecture and approval
path. v1.0 intentionally contains no activation method, no external-rail switch, and no
provider credential handling.
