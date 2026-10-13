# Hercules Gatehouse v1 (separate service)

Gatehouse is an **additive read-only command center** for SauceApproved. It is not a replacement for the existing Floodgates adapter, owner approvals, Shopify checkout, Stripe, Render deployer, Supabase policies, or any production launch control.

## Included
- **Dashboard:** premium responsive command center (phone/desktop), owner-session gated.
- **Sentinel:** bounded HTTPS GET reachability probes of allowlisted Render `/health` routes. Network reachability does *not* certify service health, payment completion, payout or launch readiness.
- **Gate Intelligence:** imports the repository's **existing** `offlineFloodgateAssessment`; permanently reports `ready:false` / `productionAuthorized:false`, even when offline evidence looks complete.
- **Revenue Radar:** only accepts explicitly attested inputs in its pure model; defaults to `null` rather than imaginary sales. The deployed server has *no* transaction import endpoint and does not pull private Shopify, Stripe or bank records.
- **Launch Simulator:** local-only synthetic cart / stock / mocked payment / mocked fulfillment / mocked payout, with declined and failed paths; never calls a processor.
- **Evidence Vault:** SHA-256 hash-linked record stream from public probe observations; detects local accidental edits but is **not** cryptographically signed, third-party attested or durable. Storage is in-memory until a separately authorized durable storage layer is wired.
- **Recovery:** local advisory plans only; never triggers an external production operation.
- **Time Machine:** compares locally observed connectivity snapshots; proposes no live rollback.
- **Deployer boundary:** its own Render service from this isolated feature branch, with auto-deploy disabled. No changes to existing production Render services.

## Run and test
Requires Node 22 or later; no npm packages or third-party code.

```bash
node --test hercules/gatehouse/*.test.mjs
GATEHOUSE_ACCESS_TOKEN=$PRIVATE_GATEHOUSE_TOKEN PORT=8787 node hercules/gatehouse/server.mjs
```

Open `http://localhost:8787` on a local machine for development. When deployed, Render serves HTTPS. The `/health` endpoint is public and deliberately contains no private data. The unauthenticated preview now shows **public read-only reachability checks** of four allowlisted Render services via `/api/public-summary`, with a shared 60-second cache to avoid excessive upstream traffic. No payment, payout, order, identity, internal log, or launch-readiness information is exposed through this route. The private Evidence Vault, Time Machine history, and full dashboard remain locked until a real `GATEHOUSE_ACCESS_TOKEN` is configured in the Gatehouse service *itself*.

**Do not paste the owner token in a chat, commit, URL, or shared log.** Use the Render service's private environment settings or existing authorized vault tooling. A session is kept only in an HttpOnly, Secure, SameSite=Strict cookie.

## Security and deployment contract
- Do not merge into `main` until test, security and provenance review. Main is wired to auto-deploy several already live services.
- Never repoint existing DNS or change payment/payout domains for this project.
- No checkout/refund/payout, release activation, owner approval, credential export, GitHub write action, Cloudflare adjustment, or provider mutation is exposed.
- Only four explicitly configured public HTTPS status endpoints on Render-hosted names can be probed; the summary publishes only service names and reachability. It does not expose URLs, provider response bodies, internal endpoint credentials, logs, or IDs. No redirection or private IP range probes.
- All private APIs return 503 if no owner credential exists, 401 if the owner session is invalid. The public cached summary intentionally remains accessible without an owner credential and grants no production authority.
- All dashboard data is read-only observation; a reachable endpoint is not a verified transaction.
- Avoid printing personal data, tokens or payment references into the Evidence Vault.
- Live rollback, auto-remediation, persistent evidence storage, authenticated provider order reconciliation and alerts require separately scoped service connections and tested authorization. Until then, those features deliberately remain advisory/in-memory.

## Validation
```bash
node --test hercules/gatehouse/gatehouse.test.mjs hercules/gatehouse/server.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

## 1.2 Public evidence capsule

Gatehouse retains at most **120 requested public connectivity observations in RAM**, with a 60-second read-cache. These are **not** continuous monitoring data and **not** measured uptime. They exist only after public status has been requested; the service does not perform background polling. The history resets when the Render process restarts.

- `GET /api/public-history`: bounded public history, service labels, timestamps and reachable/unreachable statuses only; excludes URLs, credentials, payment data, private ledger, headers and provider response bodies.
- `GET /api/public-evidence`: an attachment containing a fresh SHA-256-linked record chain of public observations plus an explicit warning that it is not signed or independently attested. A local saved export survives a server restart; the service itself remains ephemeral.
- `POST` to either public route is rejected; owner-only routes are not opened by these new endpoints.
- No paid data store, secret, checkout mutation or new network permission is needed.

The public history viewer reports **only the last sampled change**. It does not estimate uptime percentages, claim a failure is caused by the service itself, or report verified revenue.


## v1.3 — Device Vault (browser-local, best effort)
The Gatehouse dashboard now combines the existing on-demand `/api/public-history` with **on-device IndexedDB** to preserve a sanitized copy of public connectivity observations across Render process restarts, when the same browser continues retaining its local storage. Nothing is sent to a storage vendor or to the storefront. It stores only the four allowlisted public service names, timestamps and `reachable`/`unreachable` states, not customer/payment/payout/credential data.

- Capped at **720 sampled observations**, **30 days**. Duplicates are merged by timestamp; unknown or suspicious fields are discarded.
- Automatic refresh occurs every **five minutes only while the Gatehouse tab is open and visible**, with one-minute server request caching. A mobile browser may suspend background tabs at any time; this does not establish a 24/7 monitor.
- **Export device archive** downloads a portable JSON backup with explicit `providerAttested:false`, `productionAuthorized:false`, `verifiedSales:null` and `continuousMonitoring:false`; this is not a signed or tamper-proof ledger.
- **Clear device history** erases the device's public samples only after a user confirms; it never touches provider records or hosted services.
- IndexedDB is not guaranteed to survive private browsing, device storage eviction, or data clearing. If it is unavailable, export of sampled in-memory observations remains possible and is explicitly labeled nonpersistent.
- Server-side public history remains ephemeral. Durable *server-side* storage and verified Shopify/Stripe revenue collection are **not** implemented.

No launch permissions, live payments, payouts, DNS, deployments or webhook integrations are introduced in this upgrade.

## Commercial pilot preparation (no-charge preview)

The existing SauceApproved Shopify store contains a **DRAFT** `$49.00 USD` one-time diagnostic offer:
- Product: `gid://shopify/Product/15424049283392`
- Variant: `gid://shopify/ProductVariant/67754351460672`
- SKU: `HG-DIAGNOSTIC-49`

The separate Gatehouse app publishes `GET /commercial` as a no-charge marketing **preview**; it is not a checkout page. `GET /api/commercial/catalog` returns draft one-time and proposed $19/$49/$149/month subscription tiers with purchase and recurring billing explicitly disabled. `GET /api/commercial/demo-report` downloads a sample of existing **Hercules** public health checks only; it is **not a customer's website scan**, and cannot be used as paid delivery evidence.

Customer intake is represented by a pure, fail-closed validator (`normalizeIntake`) with HTTPS-origin and explicit self-attested authorization checks. It does **not** collect or store PII, resolve arbitrary DNS, perform a network request, provision a service, or submit payment. A self-attestation is not independently verified site ownership. All public commerce routes are GET-only and payment, intake, customer report delivery and subscription mutations are 404.

The `assessPaidOrderWebhook` pure helper validates a properly scoped signed Shopify webhook and the exact diagnostic variant, quantity, USD price, paid status, cancellation/refund absence. A matching signed event remains `needs-provider-readback` with `deliveryAuthorized:false`: a true paid purchase and customer's access **must** be reconciled with provider-authoritative order data before allowing delivery. No webhook receiver or secret is configured, and no payment/provisioning callback is activated.

**Still required before first paid customer:** independently verified paid checkout/reversal procedures; an authenticated customer authorization and intake path; a safe customer-domain probe constrained against SSRF/DNS rebinding; durable separated request/report storage; provable email or customer-portal delivery; refund/cancellation support; approved commercial terms/privacy. Subscription plans additionally need independent scheduled monitoring, metering, billing schedules, cancellation and client data isolation. Keep the Shopify product **DRAFT** until all first-sale prerequisites are verified. Do not invent payment verification from the demo or the live Stripe connection.

No new database, new cost, DNS modification, production release, Shopify product publish, billing or payout action was introduced here.

## Gatehouse order-to-report proof plan (preview v1.5)

The commercial page now links to `GET /commercial/report-preview`, a printable, well-labeled **sample** built only from the existing four Hercules allowlisted public health probes. It never checks an arbitrary customer domain, sends a report to a customer, or proves uptime or a transaction.

`GET /api/commercial/fulfillment-readiness` returns a public fail-closed commercial hold and an explicit list of evidence missing before any customer can buy or receive the $49 website health diagnostic. It does not accept or store customer data or payment credentials.

`fulfillment.mjs` provides a *shape validator* for a prospective authenticated Shopify Admin **read-back** of the exact single-variant diagnostic order; it rejects different products, currencies, prices, statuses, mixed carts, refunds and cancellations. Merely supplying such a matching object is **not independent payment proof**; the validator always reports `canFulfill:false` until a separately authorized, live Shopify server-side reader and customer entitlement system exist.

Both endpoints are GET only. No payment checkout, refund, subscription, email dispatch, customer claim, DNS test, deployment or provider write operations were added. The Shopify product remains draft. Future enablement requires customer ownership verification, robust SSRF-safe domain probes, durable per-customer storage, verified paid order re-read, receipt-to-customer identity reconciliation, proof of actual report delivery, terms/privacy approval, and a controlled end-to-end test. Plans remain proposal only.

Run tests with `node --test hercules/gatehouse/*.test.mjs`. The independent Gatehouse preview Render service is configured with automatic deploy **off**; this code can be tested on its feature branch without merging to `main` or disturbing live Shopify or Studio operations.

## Signed Gatehouse domain control foundation — isolated, no activation

`hercules/gatehouse/domain-proof.mjs` provides first-party, Node-standard-library helpers for a future customer-consented HTTPS domain proof. A tenant-scoped, 15-minute HMAC challenge binds the canonical public HTTPS origin to an organization's unique identity, random 24-byte nonce, and expiration. It cannot grant checkout or delivery authority.

To confirm that a customer controls the site, the future authenticated workflow can retrieve the exact nonce as `text/plain` from `/.well-known/sauceapproved-gatehouse/<48hex>.txt`. The verifier re-resolves the host, rejects **all** non-public/reserved/ambiguous DNS answers and IPv6 by default, uses only vetted public IPv4 addresses with a pinned `https.request` lookup override and matching TLS SNI certificate, disables redirect following, and limits response bytes and time. Tests exercise forged/expired/wrong-tenant tokens, internal/private DNS, redirects, false body and forged report status.

**NOT CONNECTED OR LIVE:** no public challenge issuance, user/customer intake, arbitrary domain probe endpoint, report storage, email transport, payment, hosted checkout or 24/7 monitoring has been enabled. The commercial page documents the future method without collecting site URLs. A real customer account system and validated website authorization must guard issuance; the HMAC signing key must be provided only via a secure secret manager if this workflow is later activated. Until then, `assessFulfillment()` returns HOLD, and the existing $49 Shopify product remains DRAFT. The browser tab and Render instance cannot act as independent durable evidence storage.

This work only affects the separately deployed free Gatehouse preview branch. It must not be merged into main without complete exact-head CI/security review because existing unrelated services auto-deploy there.

## Gatehouse authenticated customer intake — isolated private pilot

This release introduces a separate `hercules-gatehouse-customer-intake` Edge Function and an **additive, private** SQL schema for future customer onboarding. It uses the project's existing Supabase Auth users, does not require another merchant account, and does not modify any existing Shopify, Titan, Studio, checkout, DNS or payout records.

**Authenticated routes (no CORS access, no public website scan):**
- `GET /status` checks a signed-in, non-anonymous Supabase user and reports paid delivery on HOLD.
- `GET /sites` lists only that authenticated user's previously consented public HTTPS origins; the database query is always restricted to the server-verified `user.id`.
- `POST /sites` requires small, well-formed JSON, `authorized:true`, `consentVersion:"gatehouse-diagnostic-v1"` and a canonical public HTTPS origin. It stores only an **awaiting-domain-control** record; it does not issue domain checks or accept payment. Repeated insert does not silently override earlier consent.
- `GET /reports` lists only that customer's **withheld** report metadata (ID, site ID, status, timestamp), never customer report body or content.

The Edge Function uses a server-only service key to access only newly prefixed Gatehouse tables, with every query scoped to the authenticated Supabase `user.id`. The server rejects missing/invalid/anonymous JWTs and does not accept client-supplied owner IDs.

**Storage security:** `supabase/gatehouse_private_intake.sql` defines `gatehouse_customer_sites` and `gatehouse_customer_reports`, enforced by a composite `(site_id,owner_user_id)` foreign key. RLS is enabled on both tables, and direct `anon`/`authenticated` Data API privileges are explicitly revoked. Reports remain `withheld` by schema constraint and cannot be marked delivered in this version.

**Launch boundary:** Backend intake is not yet a public registration/login UI, domain ownership proof, paid-order attestation or successful report delivery. The $49 Shopify product stays DRAFT. Verified customer signup, encrypted/session-secure end-user UI, consent policy approval, actual DNS-pinned challenge verification, trusted Shopify paid-order readback and a proven private report-delivery route remain prerequisites to take real money.

**Operational sequencing:** Validate exact GitHub CI, apply only the additive table migration, deploy the separate Edge Function with `verify_jwt=true`, then verify owner JWT denial and authorized requests. No existing public Gatehouse page should request this function without an authenticated owner/customer session.

## Free-hosting fallback for customer intake — Render + Supabase Auth/RLS

**Provider limit encountered:** Supabase rejected a *new* Edge Function on this project with `Max number of functions reached for project, please upgrade Plan or disable spend cap`. We did **not** upgrade, remove other functions, change billing, or touch their behavior.

Instead, the existing isolated **free Render Gatehouse** HTTP listener can host `GET/POST /api/customer/sites` with the first-party `customer-bridge.mjs`. The bridge validates a supplied signed-in Supabase JWT against a fixed existing Supabase Auth endpoint. All insert/list requests use the public **publishable key**, that user's JWT, the fixed existing project URL, and PostgREST RLS. It does not use a service-role credential, accept client-supplied owner IDs, expose private reports, follow network redirects, or query unrelated Hercules tables.

The separate additive `supabase/gatehouse_customer_direct_rls.sql` grants **only SELECT and INSERT** on `gatehouse_customer_sites` to authenticated users after a strict `owner_user_id = auth.uid()` RLS insert policy, with one-site-per-user index and current consent timestamp/version checks. Reports remain ungranted and permanently withheld. No arbitrary scans, checkout, transaction ingestion, email delivery, subscription billing, or public direct payments are enabled.

**Default HOLD remains:** The Render route returns 503 unless `GATEHOUSE_CUSTOMER_INTAKE_APPROVED=true` and `GATEHOUSE_SUPABASE_PUBLISHABLE_KEY` is configured. The public key is non-secret but should be injected as Render environment configuration, not hardcoded into the repository. **Do not enable enrollment** until appropriate website/privacy policies, rate limits and customer authentication UX are reviewed. A successful authenticated site submission is still only self-attested consent; actual domain control, payment and delivery are *not* verified.

This route is a cost-avoiding fallback, not a bypass of the user's launch or payment gates.
