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
| Local state-file corruption | JSON parse + snapshot schema + journal hash-chain + replay verification |
| Partial local state-file write | Same-directory temporary file followed by atomic rename |

## Filesystem boundary

v0.2 adds a local atomic snapshot store. The filesystem is external infrastructure:
the bank runtime validates data before and after persistence but does not claim the
host filesystem itself as Hercules-owned technology. File permissions and atomic
rename reduce local corruption exposure; they do not replace encrypted storage,
multi-writer database transactions, backups, or disaster recovery.

## Explicit non-goals

v0.1 does not claim to solve:

- bank chartering or licensing;
- deposit insurance;
- KYC/KYB, AML, sanctions, transaction monitoring, or suspicious-activity workflows;
- ACH, wires, RTP/FedNow, card issuance/acquiring, checks, or cash handling;
- external settlement or reconciliation;
- production authentication/authorization;
- multi-writer database transactions, replication, backup, or disaster recovery;
- secrets, signing keys, HSM/KMS custody;
- fraud scoring, chargebacks, disputes, or consumer-regulation workflows.

## Production gate

Real-money connectivity is blocked until a later reviewed release defines and tests
the regulated-provider boundary, authorization model, durable storage, reconciliation,
audit retention, and incident controls. Sandbox passing evidence must not be described
as production banking certification.
