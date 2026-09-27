# Hercules Bank

Hercules Bank is the owned financial-core runtime inside the Hercules platform.

## Current maturity: durable sandbox ledger core

The current implementation is deliberately **not** a chartered bank, deposit account,
money-transmission service, payment processor, or custodian. It does not hold customer
funds, originate ACH/wires, issue cards, perform KYC/KYB, or represent balances as
FDIC-insured deposits.

The runtime currently provides:

- dependency-free double-entry bookkeeping;
- integer minor-unit accounting;
- account normal-side semantics;
- balanced journal enforcement;
- customer-liability internal transfers;
- fail-closed overdraft protection;
- idempotent posting;
- tamper-evident SHA-256 journal chaining;
- single-currency transaction enforcement;
- verified restart snapshots;
- atomic local state-file replacement with mode `0600` temporary files.

## Core invariant

Every committed journal transaction must satisfy:

```
sum(DEBIT amountMinor) === sum(CREDIT amountMinor)
```

No floating-point currency amounts are accepted.

## Durability boundary

`HerculesBankStateStore` persists verified ledger snapshots using a same-directory
temporary file followed by atomic rename. Loading re-verifies the journal hash chain
and replays every transaction through the ledger invariants before returning state.

This is local-process durability, not a multi-writer transactional database. The
customer metadata held by `HerculesBankSandbox` is not yet part of the persisted
snapshot.

## Trust boundary

`hercules-bank/` owns financial orchestration and ledger logic only.

Future regulated capabilities must remain behind explicit adapters and may not be
represented as Hercules-owned banking infrastructure. Before production money movement,
the project requires separate controls for identity verification, AML/sanctions,
partner-bank/payment-rail authorization, reconciliation, dispute handling, data
retention, incident response, secrets/key custody, and regulatory/legal review.

## Verification

```sh
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node --test tests/hercules-bank-*.test.mjs
```

The dedicated GitHub workflow is `.github/workflows/hercules-bank.yml`.
