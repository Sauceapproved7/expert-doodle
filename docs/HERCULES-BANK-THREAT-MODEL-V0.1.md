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
| Bearer token sent over cleartext remote HTTP | First-party client permits HTTP only for loopback endpoints; remote endpoints require HTTPS |
| Redirect-based credential forwarding | First-party client disables redirects |
| Hung upstream/service request | First-party client applies a bounded request timeout |
| Customer access to owner metrics | Owner overview requires an approved administrator role |
| UI-only owner hiding treated as authorization | Admin endpoints independently enforce role authorization |
| Aggregate sandbox liability overflow | Safe-integer accumulation fails closed |\n| Regulatory checkbox bypass | Readiness requires structured approved evidence with a reference and review timestamp; booleans are insufficient |\n| Unreviewed jurisdiction expansion | v0.8 supports only the explicit reviewed US-CT scope |\n| False deposit-insurance representation | Deposit readiness requires separate custodial-record and disclosure-review evidence and creates no insurance claim |\n| Provider traffic over insecure transport | Production provider adapter endpoints require HTTPS |\n| Settlement divergence | Reconciliation fails on missing, unexpected, duplicate, amount-mismatched, or currency-mismatched records |\n| Premature live-money activation | Readiness never enables execution; v0.8 executeTransfer is hard-locked |\n| Compliance event-field injection | Restore rejects any event whose top-level shape differs from the canonical hashed event schema |\n| Compliance evidence tampering | Sequence, previous hash, SHA-256 event hash, derived-state replay, and head hash are verified on load |\n| Sensitive KYC/provider-secret persistence | v0.9 state stores review references, provider metadata, and reconciliation summaries only |\n| Unauthorized compliance mutation | Compliance API routes require admin role; cookie-authenticated writes also require CSRF |\n| Non-transactional production storage | Production-readiness adapter requires atomic transaction capability plus health, backup, and restore verification |\n| Exportable financial signing key | Secret-custody adapter rejects secret-export functions and requires non-exportable signing/rotation interfaces |\n| Untested disaster recovery | Readiness requires recent restore evidence and bounded reviewed RPO/RTO |\n| Missing financial case handling | Fraud, disputes, returns, complaints, and case-retention evidence are mandatory |\n| Provider concentration / lock-in with no exit plan | Provider certification requires reviewed business continuity and exit-plan evidence |\n| Readiness mistaken for activation | v1.0 hard-codes activationAllowed:false and externalRailsEnabled:false |\n| Readiness adapter function leakage | v1.1 dossier sanitizes function-bearing production adapters before owner API responses |\n| Production dependency status exposed to customers | Production-readiness dossier is restricted to approved administrator roles |\n| Missing infrastructure hidden by optimistic defaults | Unconfigured production dependencies surface explicit readiness blockers |

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


## Service deployment boundary

v0.4 adds a first-party launcher and client SDK. The launcher binds to loopback by
default and requires the Base JWT signing secret before listening. The client requests
a fresh bearer token from its configured token provider for each operation and does not
write that token to Hercules Bank state.

Binding the service to a non-loopback interface is an explicit deployment choice and
does not make the service internet-safe by itself. Production exposure still requires
TLS termination, network policy, rate limiting, secret rotation, monitoring, and the
regulated controls listed above.


## Browser session boundary

v0.5 adds a browser console without exposing Hercules Base bearer credentials to page
JavaScript. The bank service stores Base access and refresh tokens in process memory and
issues only an opaque HttpOnly SameSite=Strict browser cookie.

State-changing browser requests require a separate CSRF value held only in page memory.
The value rotates after session restoration. Logout removes the bank-side session and
requests revocation of the Base refresh token.

The browser session store is intentionally memory-only. A process restart logs browser
sessions out rather than persisting bearer or refresh credentials to disk. Public HTTPS
deployments must enable Secure cookies and keep the service behind the Hercules network,
TLS, rate-limit, monitoring, and abuse-control boundary.


## Financial service launch boundary

v0.6 makes the browser-safe financial surface startable as one controlled service.

The launcher binds to loopback by default. Non-loopback binding requires Secure browser
cookies. The Base Auth bridge refuses cleartext remote HTTP endpoints, preventing sign-in
credentials or refresh material from being sent to a remote authentication service
without transport encryption.

These checks reduce accidental unsafe deployment. They do not replace TLS termination,
network policy, rate limiting, secret rotation, monitoring, or regulated financial
controls.


## Owner control boundary

v0.7 adds a summarized administrative view over sandbox customer accounts. The API
authorizes every owner/admin request independently of the browser interface. Customer
sessions therefore cannot gain administrative visibility by manipulating DOM state or
calling the owner route directly.

The overview deliberately omits raw journal records and exposes only account summaries,
customer/account counts, currency, mode, external-rail status, and aggregate sandbox
liabilities. Funding remains sandbox-only and retains the existing admin-role and CSRF
requirements.


## Regulated-money boundary

v0.8 introduces a reviewed-evidence readiness gate, a bounded regulated-provider adapter
contract, and external-settlement reconciliation. These controls are preparatory only.

A green readiness result is not a license determination, regulatory approval, bank
charter, FDIC-insurance determination, or permission to transmit money. The initial
software scope is `US-CT`, and any expansion requires a new reviewed jurisdiction
evidence record and code change.

The live provider submission path remains impossible through
`HerculesRegulatedRailBoundary` because `executeTransfer()` always fails closed with
`live_rail_execution_locked`.


## Compliance operations boundary

v0.9 adds durable compliance operations without converting Hercules into a regulated
identity repository. The persistent registry deliberately excludes KYC documents,
government identifiers, bank credentials, provider secrets, and raw settlement data.

Administrative API calls derive the actor from the authenticated Hercules Base subject.
The browser dashboard is observational: it displays evidence/readiness state and retains
the Live Money Locked state. It has no route or control that can unlock external rails.

The compliance state file is local-process durability, not a compliance-grade
multi-writer database, records-retention system, HSM/KMS, or evidence archive. Those
remain production prerequisites.


## Production-readiness boundary

v1.0 validates contracts and reviewed evidence for production infrastructure and
operations. It does not instantiate a production database, KMS/HSM, regulated provider,
or external payment rail.

The secret-custody interface deliberately excludes secret-export methods. The
transactional-store interface requires atomic mutation and backup/restore capabilities
without accepting database credentials into readiness evidence.

A green composite result means only that the defined readiness evidence is present.
It is not permission to transmit funds. v1.0 returns `activationAllowed:false` and
`externalRailsEnabled:false` unconditionally.


## Production readiness dossier boundary

v1.1 turns production readiness into an owner-observable status without expanding the
money-movement authority boundary.

The API builds the dossier server-side from the compliance registry and server-injected
production dependencies. It returns only sanitized status and never serializes adapter
functions, database credentials, KMS key material, or provider credentials.

The browser can display blockers and green controls but cannot mutate the v1.0 activation
invariant. No v1.1 route enables external rails.


## Adapter qualification boundary

v1.2 adds behavioral proof for production-readiness adapters while preserving the
fail-closed money boundary.

| Threat | v1.2 control |
| --- | --- |
| Adapter environment spoofing | Transactional-store and key-custody production contracts require the literal production environment |
| Database contract passes without real behavior | Qualification runs health, transaction round-trip, backup, and isolated restore verification |
| Restore test mutates live data | Qualification accepts restore evidence only when the adapter reports an isolated restore |
| Exportable signing key hidden behind a valid interface | Qualification inspects key metadata and requires exportable=false |
| Key rotation triggered during qualification | Qualification checks rotation capability metadata but never calls rotateKey |
| Provider qualification accidentally moves money | Qualification surface contains health/capability probes only and strips any submitTransfer function |
| Provider lacks a safe test mode | Qualification requires sandboxOrDryRun=true |
| Qualification mistaken for go-live authority | Results always keep activationAllowed=false and externalRailsEnabled=false |\n| Qualification evidence tampering | Canonical hash chain plus detached signature verification fails closed on reopen |\n| Expired qualification treated as current | Bounded TTL automatically marks evidence stale and downgrades production readiness |\n| New KMS key inherits old qualification | Secret-custody key ID participates in the signed identity fingerprint |\n| Provider or database swap inherits old qualification | Current adapter identity is fingerprint-compared to the latest signed record |\n| Browser fabricates qualification status | Evidence store and current adapter qualification are server-side dependencies only |\n| Readiness regression goes unnoticed | v1.4 compares successive sanitized dossiers and raises critical findings for green-to-blocked drift |\n| Qualification expiration arrives without warning | Sentinel emits a bounded pre-expiry warning and a critical stale finding at expiry |\n| Drift history is altered | Strict event shape, sequence, previous hash, canonical SHA-256 event hash, and head hash fail closed |\n| Customer fabricates drift state | Owner-only route builds the dossier and sentinel inputs server-side |\n| Monitoring is mistaken for activation authority | Sentinel rejects dossiers that do not keep activation and external rails locked |

Qualification functions may call candidate infrastructure health, transaction, backup,
restore-verification, signing, and capability-probe methods. Those adapters therefore
remain privileged server-side dependencies and must never be constructed from browser or
customer input.


## Qualification evidence lifecycle boundary

v1.3 persists qualification proof without persisting production credentials or private
signing keys.

The evidence signer receives only a digest. The durable record stores a key identifier
and detached signature, and reopen requires an external verifier. A canonical SHA-256
hash chain also detects record reordering or structural tampering.

Freshness and identity matching are mandatory readiness conditions. Expiration, a changed
transactional-store identity, a changed key ID, or a changed regulated-provider identity
automatically returns qualification readiness to blocked.

The browser only receives sanitized status. It cannot sign evidence, select the verifier,
change the current server-side adapter qualification, or enable external rails.


## Readiness drift sentinel boundary

v1.4 monitors sanitized readiness state rather than production credentials or customer
data. The sentinel persists only control booleans, blocker counts, qualification
freshness/identity flags, expiry time, and bounded findings.

A new check compares the current sanitized dossier with the last persisted snapshot.
Previously green overall readiness or individual controls falling blocked becomes a
critical finding. Qualification expiry can be warned before it becomes stale, and stale
or identity-changed qualification evidence is critical immediately.

The drift API is owner/admin only. Browser or customer input cannot create the dossier,
select production dependencies, or modify the sentinel's trust inputs.

The sentinel cannot grant authority. It rejects any dossier that does not contain
`activationAllowed:false` and `externalRailsEnabled:false`.
