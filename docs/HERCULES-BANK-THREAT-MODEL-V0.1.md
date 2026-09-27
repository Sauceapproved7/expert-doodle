# Hercules Bank Threat Model v0.1

## Scope

This document covers the sandbox financial-ledger core in `hercules-bank/`.
No real-money custody or regulated payment rail is in scope for v0.1.

## Protected assets

- journal integrity;
- account balances derived from journal entries;
- idempotency guarantees;
- account and currency boundaries;
- auditability of transaction ordering.

## Primary threats and controls

| Threat | v0.1 control |
| --- | --- |
| Unbalanced money creation/destruction | Reject any journal whose debit and credit totals differ |
| Floating-point rounding | Accept only positive safe-integer minor units |
| Duplicate requests | Idempotency key maps identical economics to one transaction |
| Idempotency-key substitution | Reuse with different economics fails closed |
| Customer overdraft | Non-negative accounts are checked against projected post-transaction balances before commit |
| Cross-currency value mutation | A journal may contain exactly one account currency |
| Journal alteration/reordering | Sequence + previous hash + canonical SHA-256 transaction hash |
| Partial commit | Validation and projected-balance checks occur before journal mutation |
| Unknown account posting | Account lookup fails closed |

## Explicit non-goals

v0.1 does not claim to solve:

- bank chartering or licensing;
- deposit insurance;
- KYC/KYB, AML, sanctions, transaction monitoring, or suspicious-activity workflows;
- ACH, wires, RTP/FedNow, card issuance/acquiring, checks, or cash handling;
- external settlement or reconciliation;
- production authentication/authorization;
- database durability, replication, backup, or disaster recovery;
- secrets, signing keys, HSM/KMS custody;
- fraud scoring, chargebacks, disputes, or consumer-regulation workflows.

## Production gate

Real-money connectivity is blocked until a later reviewed release defines and tests
the regulated-provider boundary, authorization model, durable storage, reconciliation,
audit retention, and incident controls. Sandbox passing evidence must not be described
as production banking certification.
