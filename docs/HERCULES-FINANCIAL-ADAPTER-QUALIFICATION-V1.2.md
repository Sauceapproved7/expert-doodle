# Hercules Financial Adapter Qualification v1.2

Date: 2026-09-27

## Purpose

v1.2 converts production adapter declarations into executable qualification evidence.

The release does not connect Hercules Financial to a real database, KMS/HSM, sponsor bank,
processor, ACH operator, card network, wire network, RTP/FedNow endpoint, or customer funds.

It defines how a candidate adapter must prove its behavior before later production review.

## Transactional store qualification

The candidate store must declare `environment: "production"` and pass:

- health check;
- transaction round-trip;
- backup creation;
- restore verification;
- explicit isolated-restore proof.

Restore testing is required to report `isolated: true` so qualification cannot count a
restore that overwrites or mutates the live production data set.

The qualifier records only bounded status such as adapter ID and pass/fail checks. It does
not expose database credentials or transaction handles.

## Key-custody qualification

The candidate key-custody adapter must declare `environment: "production"`.

Qualification verifies:

- key metadata contains a key identifier;
- `exportable === false`;
- `rotationEnabled === true`;
- a fixed qualification digest can be signed;
- the returned signature is non-empty binary data.

The qualification run does **not** call `rotateKey()`. Key rotation is a required
capability, but a qualification probe must not rotate a production key as a side effect.

No private key material is requested or returned.

## Regulated-provider qualification

The provider qualification adapter is deliberately read-only. It exposes only:

- provider ID;
- production environment;
- HTTPS endpoint;
- health check;
- capability description.

Qualification requires the provider to report:

- external-money-movement capability;
- custodial-deposit capability;
- sandbox or dry-run capability.

The qualification adapter does not expose `submitTransfer`. Even if a candidate object
contains a submission function, the validated qualification surface strips it and never
calls it.

## Fail-closed result

`qualifyFinancialProductionAdapters()` returns independent check results and blockers.

A fully qualified result still contains:

`activationAllowed: false`

`externalRailsEnabled: false`

Qualification is evidence of adapter behavior, not permission to move money.

## Relationship to v1.0 and v1.1

v1.0 defines required production contracts.
v1.1 exposes sanitized readiness status to the owner.
v1.2 proves candidate infrastructure behavior before those adapters can be treated as
credible production-readiness inputs.

No live activation path exists in v1.2.
