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
| Forged customer ownership | Account ownership derives only from a verified JWT subject |
| Cross-customer account reads | API returns not-found for accounts not owned by the token subject |
| Unauthorized sandbox minting | Funding endpoint requires an approved administrator role |
| Oversized or malformed API bodies | Bounded JSON body reader fails closed |
| Invalid/expired access token | Hercules Base JWT signature, issuer, audience, issued-at, and expiry verification |

## Authentication boundary

v0.3 reuses the Hercules Base access-token contract. The bank runtime does not
issue passwords, refresh tokens, or independent banking credentials. It verifies
Base-issued bearer tokens and binds account ownership to the token subject.
Authorization failures are returned without exposing whether another customer's
account exists.

This local API does not itself provide TLS termination, distributed rate limiting,
device binding, MFA, or regulated identity verification. Those remain separate
production-edge and compliance requirements.

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


## API authentication boundary

v0.3 introduces an authenticated HTTP service for the sandbox bank.

Current controls:
- verifies Hercules Base access tokens before customer operations;
- derives customer ownership from the verified token subject;
- hides accounts owned by other customers;
- limits sandbox funding to administrator roles;
- serializes durable mutations so concurrent requests cannot overspend the same balance;
- rejects oversized or malformed request bodies;
- keeps external payment rails disabled.

Production use still requires deployment controls such as TLS, rate limiting, secret
rotation, environment isolation, durable audit retention, and regulated-provider review.


## Browser session boundary

v0.4 adds a browser console without exposing Hercules Base bearer credentials to page
JavaScript. The bank service stores Base access and refresh tokens in process memory and
issues only an opaque HttpOnly SameSite=Strict browser cookie.

State-changing browser requests require a separate CSRF value held only in page memory.
The value is rotated after session restoration. Logout removes the bank-side session and
requests revocation of the Base refresh token.

The browser session store is intentionally memory-only. A process restart logs browser
sessions out rather than persisting bearer or refresh credentials to disk. Public HTTPS
deployments must enable Secure cookies and place the service behind the normal Hercules
TLS, rate-limit, and abuse-control boundary.
