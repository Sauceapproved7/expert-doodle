# Hercules Bank

Hercules Bank is the owned financial-core runtime inside the Hercules platform.

## Current maturity: deployable authenticated durable sandbox financial service with production-readiness and adapter-qualification controls

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
- atomic local state-file replacement with mode `0600` temporary files;
- authenticated HTTP API using Hercules Base JWT verification;
- per-customer account isolation from the verified token subject;
- admin-only sandbox funding;
- serialized copy-on-write durable mutations.

## Core invariant

Every committed journal transaction must satisfy:

```
sum(DEBIT amountMinor) === sum(CREDIT amountMinor)
```

No floating-point currency amounts are accepted.

## API boundary

The v0.3 HTTP API uses Hercules Base HS256 access-token verification with explicit
issuer and audience checks. Customer ownership is derived from the verified JWT
`sub` claim, never from request-body customer IDs.

Current authenticated routes include customer account creation/list/read,
statements, internal sandbox transfers, and an admin-only sandbox funding route.
The external-transfer endpoint is intentionally present only as a fail-closed
`external_rails_disabled` response.

## Durability boundary

`HerculesBankStateStore` persists verified ledger snapshots using a same-directory
temporary file followed by atomic rename. Loading re-verifies the journal hash chain
and replays every transaction through the ledger invariants before returning state.

This is local-process durability, not a multi-writer transactional database. Customer
account ownership metadata and the ledger snapshot are persisted together and revalidated
on restart.

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


## Authenticated API boundary

v0.3 adds a local HTTP API backed by the durable sandbox runtime.

- Hercules Base HS256 access tokens are verified with issuer, audience, expiry, and signature checks.
- Account ownership is derived from the verified JWT `sub`; clients cannot choose another customer identity.
- Customer account reads return 404 for accounts owned by another subject.
- Transfer source accounts must belong to the authenticated subject.
- Sandbox funding is restricted to configured administrator roles.
- Request bodies are bounded to 64 KiB and malformed JSON fails closed.
- Responses disable caching and include basic browser hardening headers.
- External payment rails remain disabled and return `501 external_rails_disabled`.

The API is still a sandbox control surface. It is not an authorization to hold deposits
or connect to ACH, wire, card, RTP/FedNow, or other regulated money movement.


## Service and client boundary

v0.4 makes the sandbox bank runnable as a first-party Hercules service.

- `startHerculesBankService` opens durable state, creates the authenticated API, and
  listens on `127.0.0.1` by default.
- Runtime configuration requires an explicit durable state path and the Hercules Base
  JWT secret. Weak JWT secrets fail before the service listens.
- `HerculesBankClient` obtains access tokens from a caller-supplied token provider for
  each request; it does not persist bearer tokens.
- The client refuses cleartext HTTP endpoints unless they are loopback
  (`127.0.0.1`, `localhost`, or `::1`).
- Requests disable redirects, use bounded timeouts, disable caching, and send bearer
  credentials only in the Authorization header.
- Customer operations and the admin-only sandbox funding route remain the only exposed
  money-like functions. External rails stay disabled.

The command-line service reads `HERCULES_BANK_STATE_PATH`,
`HERCULES_BASE_JWT_SECRET`, optional `HERCULES_BANK_HOST`,
`HERCULES_BANK_PORT`, and `HERCULES_BANK_CURRENCY`. It prints service metadata only,
never the JWT secret.


## Browser customer experience

v0.5 adds the Hercules Financial sandbox console on top of the deployable v0.4 service.

- Browser sign-in is forwarded server-to-server to Hercules Base.
- Hercules Base access and refresh tokens stay in bank-service process memory.
- The browser receives only an opaque `bank_session` cookie with `HttpOnly` and `SameSite=Strict`.
- Cookie-authenticated mutations require an in-memory `X-Bank-CSRF` value.
- Session restoration rotates the CSRF value.
- Expired Base access tokens refresh server-side.
- Logout removes the browser session and requests Base refresh-token revocation.
- The console exposes sandbox accounts, balances, statements, account creation, and internal transfers.
- No real deposit, ACH, wire, card, RTP/FedNow, or cash controls are exposed.

For public HTTPS deployment, secure session cookies must be enabled and the service must
remain behind the normal Hercules TLS, rate-limit, monitoring, and abuse-control boundary.


## One-command Financial launch

v0.6 adds `startHerculesFinancialService`, which opens durable bank state, connects the
server-side Hercules Base Auth bridge, enables browser sessions and the Financial
console, and listens as one service.

Defaults remain local-only. A non-loopback bind fails unless secure browser cookies are
enabled. The Base Auth bridge also refuses plain remote HTTP; remote authentication
endpoints must use HTTPS, while loopback HTTP remains available for local development.

CLI deployments use:
- `HERCULES_BANK_STATE_PATH`
- `HERCULES_BASE_AUTH_URL`
- `HERCULES_BASE_JWT_SECRET`
- optional `HERCULES_BANK_HOST`
- optional `HERCULES_BANK_PORT`
- optional `HERCULES_BANK_CURRENCY`
- optional `HERCULES_BANK_SECURE_COOKIES=true`

External money rails remain disabled.


## Owner control boundary

v0.7 adds an owner/admin control center without weakening the v0.5 browser-session
security model.

- `GET /v1/admin/overview` requires an approved administrator role and returns only
  bounded sandbox account summaries, customer/account counts, and aggregate sandbox
  liabilities. Raw journal internals are not exposed.
- The browser shows Owner controls only after the server authorizes the admin overview.
  Hiding the owner navigation is presentation only; server-side authorization remains
  authoritative.
- Sandbox funding continues through the existing admin-only endpoint and requires the
  browser CSRF token for cookie-authenticated sessions.
- Aggregate liability math fails closed if it exceeds the safe integer range.
- All values remain sandbox test balances. External deposits, ACH, wires, cards,
  RTP/FedNow, and cash controls remain disabled.


## Regulated-money boundary

v0.8 adds a fail-closed regulated-money readiness and provider boundary while keeping
all live external execution disabled.

- reviewed evidence is required for partner authorization, jurisdiction authorization,
  identity verification, AML, sanctions, transaction monitoring, reconciliation,
  disputes, incident response, retention, and legal review;
- the initial reviewed jurisdiction scope is explicitly `US-CT`;
- deposit programs additionally require custodial-ownership recordkeeping and
  deposit-insurance disclosure review;
- production provider endpoints must use HTTPS;
- settlement reconciliation detects missing, unexpected, duplicate, amount-mismatched,
  and currency-mismatched provider records;
- readiness-green does not mean execution-enabled;
- `HerculesRegulatedRailBoundary.executeTransfer()` remains hard-locked in v0.8.

See `docs/HERCULES-FINANCIAL-REGULATED-BOUNDARY-V0.8.md` for design sources and limits.


## Compliance operations

v0.9 operationalizes the v0.8 readiness model while keeping external execution locked.

- compliance evidence is stored as bounded metadata, not source documents or identity data;
- every compliance mutation is recorded in a tamper-evident hash-chained event history;
- regulated-provider profiles store contract metadata only and exclude API credentials;
- KYC/AML/sanctions integrations must implement the bounded compliance-provider adapter;
- reconciliation persists result summaries and exception counts, not raw provider datasets;
- owner-only compliance routes inherit Hercules Base authorization and browser CSRF controls;
- the Financial console shows compliance readiness and a permanent Live Money Locked state;
- `HERCULES_BANK_COMPLIANCE_STATE_PATH` may override the default compliance-state path.

See `docs/HERCULES-FINANCIAL-COMPLIANCE-OPERATIONS-V0.9.md`.


## Production-readiness proof

v1.0 defines the next production boundary without enabling real-money execution.

- production storage must implement atomic transactions, health checks, backup creation,
  and verified restore;
- secret/key custody must be non-exportable and support signing, key inspection, and
  rotation;
- recovery evidence requires recent tested restore proof plus reviewed RPO/RTO;
- fraud, disputes, returns, complaints, and case-retention operations require reviewed
  evidence;
- provider certification requires authorization, regulatory scope, security,
  data-protection, audit-rights, continuity, incident, reconciliation, and exit-plan
  evidence;
- a fully green v1.0 result still returns `activationAllowed:false` and
  `externalRailsEnabled:false`.

See `docs/HERCULES-FINANCIAL-PRODUCTION-READINESS-V1.0.md`.


## Production readiness dossier

v1.1 exposes the v1.0 readiness evaluator through a sanitized owner-only status surface.

- `GET /v1/admin/production-readiness` derives regulated readiness from the current
  compliance registry;
- missing production infrastructure is reported as explicit blockers;
- transactional-store and key-custody function references are stripped before a response
  reaches the browser;
- the Owner console shows transactional store, key custody, recovery proof, case
  operations, provider certification, and blocker status;
- the dossier contains no database credentials, key material, provider secrets, or raw
  adapter functions;
- green readiness still returns `activationAllowed:false` and
  `externalRailsEnabled:false`.

See `docs/HERCULES-FINANCIAL-READINESS-DOSSIER-V1.1.md`.


## Production adapter qualification

v1.2 adds executable qualification for candidate production infrastructure without
introducing live credentials or external money movement.

- production database adapters must explicitly identify as production and prove health,
  transactional round-trip, backup creation, and isolated restore verification;
- production key-custody adapters must explicitly identify as production and prove
  non-exportable key metadata, rotation-enabled metadata, and signing capability;
- qualification never rotates a key;
- regulated-provider qualification is read-only and requires HTTPS, health, declared
  money/custody capabilities, and a sandbox or dry-run mode;
- provider qualification never exposes or invokes `submitTransfer`;
- qualification success still returns `activationAllowed:false` and
  `externalRailsEnabled:false`.

See `docs/HERCULES-FINANCIAL-ADAPTER-QUALIFICATION-V1.2.md`.
