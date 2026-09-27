# Hercules Financial Readiness Drift Sentinel v1.4

Date: 2026-09-27

## Purpose

v1.4 continuously compares sanitized Hercules Financial production-readiness snapshots
so a previously green control cannot silently regress.

The sentinel is monitoring and evidence only. It has no authority to activate money
movement.

## What is monitored

Each check stores only bounded readiness state:

- overall readiness boolean;
- blocker count;
- readiness state for regulated money, transactional storage, secret/key custody,
  recovery, case operations, provider certification, and adapter qualification;
- adapter-qualification stale/identity-change flags;
- adapter-qualification expiration timestamp.

Database credentials, provider credentials, signing keys, customer information, and raw
adapter objects are not stored.

## Drift findings

The sentinel emits:

- **critical**: overall readiness regressed from green to blocked;
- **critical**: an individual control regressed from ready to blocked;
- **critical**: qualification evidence became stale;
- **critical**: adapter identity changed and requalification is required;
- **warning**: readiness blocker count increased;
- **warning**: qualification evidence is approaching expiration.

The default qualification-expiry warning window is 48 hours and may be bounded by the
caller.

## Durable history

Drift history uses:

- strict event schema validation;
- monotonic sequence numbers;
- previous-event hash chaining;
- canonical SHA-256 event hashing;
- atomic same-directory temporary-file replacement;
- mode 0600 temporary files.

Any persisted event mutation fails closed when the sentinel reopens.

## Owner API

`GET /v1/admin/readiness-drift`

The route requires an approved administrator role. Hercules builds the current
production-readiness dossier server-side, then passes that sanitized dossier to the
sentinel.

Customer/browser request data cannot construct the current production dependencies,
qualification evidence, or sentinel state.

## Financial service

The one-command Financial service opens drift state automatically at:

`<HERCULES_BANK_STATE_PATH>.readiness-drift.json`

An alternate path may be supplied with:

`HERCULES_BANK_READINESS_DRIFT_STATE_PATH`

## Owner console

The production-readiness section displays:

- **STABLE** when no findings exist;
- **WARNING** for non-critical drift such as approaching evidence expiry;
- **CRITICAL** for readiness regression, stale qualification evidence, or adapter
  identity change.

## Activation invariant

Every persisted event and every check result keeps:

`activationAllowed: false`

`externalRailsEnabled: false`

The sentinel rejects any dossier claiming otherwise. No v1.4 route or UI control enables
external money movement.
