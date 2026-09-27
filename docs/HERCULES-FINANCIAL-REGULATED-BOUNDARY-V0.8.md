# Hercules Financial Regulated Boundary v0.8

Date: 2026-09-27

## Purpose

This release adds the software boundary that must exist before Hercules Financial can
ever connect to real customer money. It does **not** enable live external money movement
and does not assert that SauceApproved, Hercules, or any configured provider is a bank,
money transmitter, FDIC-insured institution, or otherwise licensed.

The boundary is deliberately fail-closed.

## Regulatory design inputs

The code is structured around current official regulatory materials, while leaving legal
determinations to reviewed evidence rather than software assumptions.

### Connecticut money transmission

The Connecticut Department of Banking describes money transmission as, among other
things, receiving money or monetary value for current or future transmission or
transmitting money or monetary value. Connecticut publishes licensed money transmitters
through its Department of Banking / NMLS process.

Source:
https://portal.ct.gov/DOB/Consumer-Credit-Licenses/Consumer-Credit-Licenses/Money-Transmitters-Licensed-in-Connecticut

Hercules therefore does not infer that a software provider, sponsor, agent relationship,
or contract creates authority to transmit funds. The v0.8 gate requires reviewed
`jurisdictionAuthorization` evidence for the initial `US-CT` launch scope.

### FDIC pass-through deposit treatment

FDIC guidance explains that pass-through deposit insurance is not a separate ownership
category and depends on requirements including actual ownership by the principal and
records that disclose the agency/custodial relationship. FDIC consumer guidance also
warns that funds sent to a nonbank are not eligible for FDIC insurance merely because
that company says it works with an FDIC-insured bank.

Sources:
https://www.fdic.gov/financial-institution-employees-guide-deposit-insurance/pass-through-deposit-insurance-coverage
https://www.fdic.gov/consumer-resource-center/2024-06/banking-third-party-apps

For a `deposit_program`, v0.8 therefore requires reviewed evidence for
`custodialOwnershipRecords` and `insuranceDisclosureReview`. The software never turns
those records into an FDIC-insurance claim by itself.

### Customer due diligence

FinCEN's current CDD materials continue to require covered financial institutions to
obtain, verify, and record beneficial-owner identities for legal-entity customers,
subject to the February 13, 2026 exceptive relief concerning repeated verification at
each later account opening.

Sources:
https://www.fincen.gov/resources/statutes-and-regulations/cdd-rule-faqs
https://www.fincen.gov/news/news-releases/fincen-issues-exceptive-relief-streamline-customer-due-diligence-requirements

Hercules therefore requires reviewed identity-verification, AML, sanctions, and
transaction-monitoring evidence before the readiness state can become green. v0.8 does
not itself perform regulated KYC/KYB or AML screening.

### Third-party provider risk

On September 11, 2026, the OCC, Federal Reserve, FDIC, and NCUA issued proposed revised
third-party risk-management guidance. It is proposed guidance, not a final binding
standard. It emphasizes tailoring oversight to the actual risks of each relationship.

Sources:
https://www.occ.treas.gov/news-issuances/bulletins/2026/bulletin-2026-46.html
https://occ.treas.gov/news-issuances/news-releases/2026/nr-ia-2026-77.html

Hercules uses a narrow provider contract and explicit evidence records so provider
relationships can be reviewed without hard-coding a claim that a specific supervisory
framework has been satisfied.

## Required readiness evidence

Every launch requires reviewed evidence for:

- partner authorization;
- jurisdiction authorization;
- identity verification;
- AML program;
- sanctions screening;
- transaction monitoring;
- reconciliation;
- disputes;
- incident response;
- financial data retention;
- legal review.

A deposit program additionally requires:

- custodial ownership / FBO recordkeeping review;
- deposit-insurance disclosure review.

Evidence must be a structured record with:

- `status: "approved"`;
- a non-empty evidence/reference identifier;
- a parseable review timestamp.

A boolean switch is intentionally insufficient.

## Provider adapter contract

`validateRegulatedProviderAdapter()` accepts only a bounded provider surface:

- provider identifier;
- environment;
- endpoint;
- `submitTransfer`;
- `fetchTransfer`;
- `listSettlementRecords`.

Production endpoints must use HTTPS. Non-production cleartext HTTP is permitted only on
loopback.

No concrete bank, processor, card network, ACH operator, or payment provider is bundled
into the owner-code runtime.

## Reconciliation

`reconcileExternalSettlements()` compares internal and provider settlement records by
reference, positive integer minor-unit amount, and currency.

It reports:

- missing provider records;
- unexpected provider records;
- amount mismatches;
- currency mismatches;
- duplicate provider records.

Any such difference produces `ok: false`.

## Live execution lock

`HerculesRegulatedRailBoundary.prepareTransfer()` can validate and prepare a prospective
external instruction only after the readiness gate is green.

Every prepared instruction is marked:

`executionAllowed: false`

`executeTransfer()` always fails with:

`live_rail_execution_locked`

This is intentional. v0.8 creates the regulated boundary without authorizing real-money
execution.

## Next production prerequisites

A future reviewed release would still need, at minimum:

- an actually contracted and approved regulated provider/sponsor-bank relationship;
- authoritative licensing/exemption determination for the real product and jurisdictions;
- production KYC/KYB/AML/sanctions integrations;
- secrets/key custody;
- durable audit and compliance evidence storage;
- settlement and exception operations;
- consumer disclosures and agreements;
- fraud, disputes, returns, reversals, and complaints;
- regulatory/legal approval for the specific launch model;
- explicit owner approval before irreversible live-money activation.
