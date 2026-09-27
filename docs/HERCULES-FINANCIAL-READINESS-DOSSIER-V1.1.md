# Hercules Financial Readiness Dossier v1.1

Date: 2026-09-27

## Purpose

v1.1 operationalizes the v1.0 production-readiness evaluator inside the running
Hercules Financial owner surface.

The dossier answers one question continuously:

What production controls are still missing?

It does not create an activation path.

## Owner-only API

`GET /v1/admin/production-readiness`

The route requires an approved Hercules administrator role and combines:

- current v0.9 compliance readiness;
- injected transactional-store capability;
- injected secret/key-custody capability;
- recovery evidence;
- financial case-operations evidence;
- provider onboarding certification.

When production dependencies are not configured, the route returns explicit blockers.

## Sanitization

The dossier is intentionally different from the internal v1.0 evaluator result.

It never returns callable adapter functions such as:

- `withTransaction`;
- `createBackup`;
- `verifyRestore`;
- `signDigest`;
- `rotateKey`.

It exposes only bounded owner-facing status such as adapter identity, environment,
recovery targets, readiness booleans, certification state, and blocker counts.

No database credentials, KMS secrets, provider credentials, or raw key material belong
in the dossier.

## Console

The Owner view now presents:

- transactional store status;
- key-custody status;
- recovery-proof status;
- financial case-operations status;
- provider-certification status;
- current blocker count and blocker descriptions.

The console remains observational only.

## Activation invariant

Whether every production control is missing or every control is green, the dossier always
returns:

`activationAllowed: false`

`externalRailsEnabled: false`

There is no activation endpoint in v1.1 and no activation control in the browser.
