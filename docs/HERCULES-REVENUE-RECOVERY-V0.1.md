# Hercules Revenue Recovery v0.1

## Purpose

Hercules Revenue Recovery is an evidence-first receivables decision layer for small businesses.

It is intentionally not a generic reminder scheduler. Its first owned capability answers four questions for each receivable:

1. What state is this invoice actually in?
2. What evidence supports that state?
3. Is contact safe and appropriate?
4. What is the smallest next action, and does it require owner approval?

## v0.1 contract

`hercules-recovery/recovery-core.mjs` exposes `assessRecoveryCase(input)`.

The assessment is deterministic for the same input and returns:

- a canonical recovery state;
- a bounded priority score;
- explicit reason codes;
- contact-safety status;
- a next-action contract;
- an evidence snapshot;
- a SHA-256 digest of the evidence snapshot;
- an explicit confidence label.

### Fail-closed boundaries

v0.1 suppresses automated outreach when:

- payment evidence fully satisfies the invoice;
- the account is marked do-not-contact;
- an invoice dispute is open;
- an active promise-to-pay is still pending.

Recovery-ready invoices still require owner approval before outreach.

## Distinctive product direction

The product center is the recovery decision and its evidence, not the communication channel.

Future increments should preserve this separation:

- accounting/ERP connectors provide facts;
- the recovery engine classifies and recommends;
- communication adapters execute only approved actions;
- payment/dispute/promise evidence can invalidate or halt outreach;
- every material decision remains inspectable and reproducible.

This keeps Hercules from becoming another generic dunning scheduler and creates a reusable trust layer for later automation.

## Not included in v0.1

- no accounting-provider SDK;
- no email/SMS/calling integration;
- no autonomous debt collection;
- no payment processing;
- no credit reporting;
- no legal escalation;
- no production deployment;
- no claim that a balance is collectible or will be recovered.

## Verification

Run:

```sh
node --test tests/hercules-recovery.test.mjs
```

The Hercules Revenue Recovery CI workflow runs this contract test for pull requests that touch the recovery surface.
