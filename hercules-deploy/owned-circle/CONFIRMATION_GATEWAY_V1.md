# Hercules Circle Confirmation Gateway — isolated first-party API

**Stage: built and tested in development only. Not deployed, not sending mail.**

This is original Hercules-owned Node HTTP request-handling logic to connect the privately stored single-use email challenge and email-confirmation engine to an approved HTTPS backend **when a legitimate owner-controlled sender and durable rate-limit service exist**. It is not a customer account system and cannot replace domain email authorization.

## Endpoints (only after independent verification and authorized deployment)

- `GET /health`: non-sensitive gate status, `held` by default.
- `POST /api/confirm/request`: from the exact Hercules-owned static origin only. Accepts a JSON email. Requires separately verified sender/receipt/storage/origin/owner release controls through a trusted server-side readiness decision. Generic reply to prevent address/consent enumeration.
- `POST /api/confirm/verify`: from exact Hercules origin only. Accepts a 64-character hex single-use token. The attached owner confirmation engine calls a **private service-role-only database transaction** to update both founder email verification and consumed challenge atomically.
- Strict content-type, 2 KB request limit, basic per-socket-IP in-memory throttling, fail-closed errors, no client-provided authorization flags, no logging/echoing of addresses or tokens.
- No public subscriber listing, owner records, payments, hosted application access, beta invitations, email sending vendor, or SMTP credentials in this API module.

## Important release blockers and limitations

- **This module is a handler, not a running production server.** It uses dependency-injected private engine and verified-readiness configuration. There is no existing API service hosting or deployed send transport proven for Hercules Circle.
- **Never activate with client-submitted `ready` flags.** The operator must independently verify its sender, recipient receipt, durable store, HTTPS, owner approval and site behavior before mounting a handler. No frontend or public caller may set these.
- The local in-memory rate limiter is only defense-in-depth and cannot enforce global caps across multiple web instances or restarts. **A durable independent per-address/IP quota and abuse protection are mandatory before any public release.** The challenge table currently prevents duplicate email challenges, but does not by itself prove a scalable rate limiter.
- Free Render web-services cannot rely on ephemeral SQLite subscriber storage, and commonly block direct outbound SMTP ports. This handler may be safely evaluated locally or as a private staging prototype; it must **not** be attached to the public static site as if email delivery works.
- No verified SMTP server, SPF/DKIM/DMARC sender setup or actual external email receipt exists yet. The SauceApproved continuity ledger still shows `waiting_provider_authorization`.
- Do not publish project administrative tokens in browser code or logs. The sensitive DB adapter is server-only.

## Live fail-closed readiness (source-only, not a sender)

The gateway no longer accepts `readiness: {ready:true}` or any other static truthy flag as release authority. The constructor accepts an **owner-server-only asynchronous `readiness()` function**, not an HTTP/client field. This function must independently check each of these conditions and return an evidence object:

- `checkedAt`: integer epoch milliseconds observed at the trusted backend, at most 120 seconds old and no more than five seconds into the future
- `senderDomainVerified`: provider explicitly verifies the actual sending domain (not merely that DNS looks plausible)
- `providerConnectionVerified`: currently authenticated and authorized sending transport
- `outboundReceiptVerified`: independently observed genuine external delivery proof, not a simulated/mock send
- `durableRateLimitReady`: owner-controlled global durable anti-abuse enforcement, not the gateway's in-memory counter alone
- `privateChallengeStoreReady`: private backend challenge and single-use confirmation store independently operational
- `ownerReleaseApproved`: current explicit owner-controlled release decision

**Every flag must be exactly `true`**. Gateway calls `readiness()` for each health/request/verify check, with a 2-second timeout. Missing, stale, malformed, throwing, revoked or timed-out evidence responds as held before any engine request/consume call. Client-provided flags never count. An "eligible" health response is not permission to deploy; deployment remains a separate owner-controlled operation.

**As of October 13:** Resend reports the business sending domain `failed` (DKIM and SPF records failed). The owner continuity ledger records `waiting_provider_authorization`, `dnsReady=false`, `providerConnectionReady=false`; Spaceship OAuth remains pending. Therefore any truthful readiness implementation returns held. **No actual production readiness function has been connected and no email has been sent by this module.**

## Independent proof

The unit/integration suite boots a temporary local HTTP server, tests held mode, strict origin/CORS, no enumeration, 2 KB bounds, rate limiting, token rejection and successful mocked redemption. It never sends emails, creates real subscribers or makes live database calls.

`node --test tests/hercules-circle-confirmation-gateway.test.mjs`

No existing Render services, Supabase schemas, DNS, storefront, checkout, public-registration gates, sender settings, prices or subscriber records are changed by this feature branch.

**SEEK KNOWLEDGE. BUILD POWER. PROVE EVERYTHING.**
