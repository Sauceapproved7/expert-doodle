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

## v1.7 — Owner-gated existing-customer passwordless sign-in

The isolated Gatehouse preview now contains a first-party `/portal/access` page, linked from `/portal`, and a passwordless email-code authentication adapter in `customer-auth.mjs`. This is preparation for an independently verified customer login path, **not activation of a new public customer account system**.

`GET /api/customer/auth/capability` is a public status disclosure: `emailCodeEnabled` only when the independent `GATEHOUSE_CUSTOMER_AUTH_APPROVED=true` approval gate AND existing Supabase `GATEHOUSE_SUPABASE_PUBLISHABLE_KEY` are configured. Both are **not enabled by this PR**. The separate site-intake flag, commerce checkout, reports and subscriptions remain closed.

If approved and configured later:
- `POST /api/customer/auth/request-code` forwards only to the fixed project Supabase Auth OTP endpoint with **`create_user:false`**. No new users are registered by this flow. The response is generic to avoid distinguishing existing vs missing email accounts. An in-process 60-second per-address throttle and provider throttling apply.
- `POST /api/customer/auth/verify-code` validates a numeric 6–8 digit email code through Supabase Auth, then independently verifies the returned access token against the fixed Supabase Auth `/user` route. Failure never grants a session.
- A verified access token stays inside a **Secure, HttpOnly, SameSite=Strict, Path=/** `__Host-gh_customer_session` cookie, capped by the provider's short-lived access token expiry. No refresh token is persisted, so the user must sign in again after the access token expires. No browser localStorage, browser-visible access token, URL token, or external auth JS.
- `GET /api/customer/auth/session` verifies the cookie with Supabase and returns only `signedIn`, not the account's email or raw provider token. `POST /api/customer/auth/logout` clears the cookie.
- Mutating authentication and cookie-based site submission require the **fixed Gatehouse HTTPS Origin** and a first-party custom request header. Network requests can only reach the existing fixed Supabase project, with redirect denial and timeouts.
- Auth still **does not** enable customer intake by itself. `GATEHOUSE_CUSTOMER_INTAKE_APPROVED` remains an independent required approval gate. An authorized customer site is only an `awaiting-domain-control` record, not permission to charge or deliver a report.

**Owner / provider checks required before activating:** approve applicable privacy and customer terms, verify the Supabase Email OTP template actually sends numeric codes (Supabase defaults to a magic link unless configured), inspect configured email provider capacity and rate limits, protect route from abusive automated use, confirm owner-approved customer support and account deletion, and test OTP → cookie → Supabase owner identity → RLS → revocation end to end.

The $49 Shopify Gatehouse diagnostic remains DRAFT. No new user enrollment, live email sending, additional paid provider, cash movement, payout mutation, or irreversible launch settings were performed in this implementation.

## v1.8 — Verified domain diagnostic core and private withheld report contract

This release adds the next actual technical component required to monetize the $49 Gatehouse Website Health Diagnostic. It is **not a customer checkout, publicly callable scanner, login activation or automated report delivery release**.

### Secure read-only site diagnostic

- The first-party `runVerifiedSiteDiagnostic` requires a *valid, unexpired, organization-scoped HMAC domain challenge* and performs the original DNS-pinned website-control request before touching the website root.
- Only after verified control, it issues a **single fixed HTTPS `HEAD /`** probe pinned to a previously vetted public IPv4. TLS hostname verification is required, redirects are **not followed**, headers are bounded and stripped to fixed observed/not-observed booleans, and no response body is read. No credentials, cookies, arbitrary paths, JavaScript execution, resource crawling, payment testing or security penetration testing.
- Reports distinguish `HEAD` not supported (405), redirects (not followed), client/server error responses, and unobserved status. Header recommendations are carefully worded as *not observed on this HEAD response* rather than security vulnerabilities or uptime promises. Raw cookies, URLs from Location, network IPs and provider headers are never included in report outputs.

### Withheld, tenant-scoped report representation

- `buildWithheldSiteReport` requires a server-loaded (never browser-trusted) Gatehouse site row, authenticated requester's exact owner UUID, current recorded consent (max 30 days), an unexpired signed domain challenge and exact site-host match before any network activity.
- Returns a strictly bounded record suitable for the **existing private** Gatehouse report table, with `delivery_state: "withheld"` and explicit `paid_order_verified:false` / `customer_report_released:false`. It deliberately performs **no database writes**; future independent authenticated storage integration must bind the database RLS scopes and audit record.
- No customer domain checks, fee collection or report delivery are exposed to the public route. The new `GET /commercial/website-diagnostic-preview` shows an **illustrative report with fictional values**, clearly labeled neither an actual customer scan nor a paid deliverable.
- Customer sign-in remains disabled; the website intake remains disabled; the $49 Shopify product remains DRAFT. No report was produced for a real customer.

**Still outstanding to receive money:** owner-approved privacy and offer terms, actual authenticated customer onboarding, safe domain-control proof through the customer portal, authenticated Shopify purchase re-read (the existing backend provider vault currently lacks necessary credential refs), private stored-report creation, verified delivery to the correct buyer, and a controlled real checkout/refund test. Do not switch on paid checkout until these work together.

No new paid infrastructure, Shopify product publication, DNS, payout, new Edge Function, service-role key or production deployment.

## v1.9 — Private customer report vault (metadata only)

Adds a new **GET-only**, owner-scoped `/api/customer/reports` endpoint and the public-but-noninteractive `/portal/reports` SauceApproved branded vault. The browser uses only the existing Secure, HttpOnly, SameSite=Strict customer session cookie; it never receives a raw Supabase access token or embeds a service-role key.

**Independent closed-by-default gate:** `GATEHOUSE_CUSTOMER_REPORT_INBOX_APPROVED` must be exactly `true` **and** a preexisting `GATEHOUSE_SUPABASE_PUBLISHABLE_KEY` must be configured. This is separate from `GATEHOUSE_CUSTOMER_AUTH_APPROVED`, customer intake, checkout and report delivery. This release does not activate any of these flags.

The server validates the Supabase Auth token against fixed-project `/auth/v1/user`, rejects anonymous identities, then reads **only five allowed report metadata columns** (id, site_id, owner_user_id, delivery_state, created_at) from the existing private PostgREST table, filters by the trusted user's ID and independently checks that every returned row belongs to that user and remains withheld. It never selects or serializes the `summary` report JSON, buyer information, tokens, checkout records, or arbitrary provider data. It never accepts write requests or downloadable report paths.

`supabase/gatehouse_report_metadata_rls.sql` is an **additive minimal grant** of SELECT on only the five permitted columns to `authenticated` with owner-specific RLS; anonymous Supabase sessions are excluded. It does **not** grant `SELECT summary`, INSERT, UPDATE, DELETE, delivery transitions or any other privileged access. The existing composite site/owner foreign-key constraint remains intact.

No stored customer reports exist at this stage. A report is only a *withheld record* until buyer identity, provider-authoritative paid/refund state, and authenticated delivery are independently verified. This upgrade does not make the $49 diagnostic sellable. Keep the Shopify product DRAFT. Do not enable sign-in or inbox flags until customer privacy/commercial terms, provider email-code sign-in and authorization tests are approved.

This is isolated to the free Gatehouse preview service; no unrelated Render, Shopify, payout, DNS, or main-branch changes. The repository unit tests and Render build run `node --test hercules/gatehouse/*.test.mjs`.

## v2.0 — Buyer reference preparation

This branch adds offline owner/site-scoped purchase intent references and strict local candidate matching for the Gatehouse $49 service. The buyer reference has no email or user identifier. The matching model compares a prospective provider order shape against the original product, variant, price, refund/cancellation state, and authenticated identity, but NEVER grants access or verifies a real payment. A matching shape is not a confirmed purchase.

The proposed Supabase table is private, RLS enabled, and contains only pending records; no public grant or issuing endpoint. The GET-only purchase-link readiness endpoint returns HOLD. The existing native Shopify server connection has missing credential references. Therefore the product remains DRAFT, reports withheld, and payment, delivery, and subscriptions disabled. No production services, domain, payouts, or checkout were modified.

## v2.1 — Credential-gated native Shopify order-readback, private owner route

This release creates a strict **native** read-only Shopify Admin adapter for the existing SauceApproved canonical store and exact Gatehouse diagnostic variant. It uses a schema-validated, PII-free Admin GraphQL query and independently verifies the returned `shop.id` and `shop.myshopifyDomain` before accepting an observation. A single bounded page of at most 10 orders is inspected for paid, not test/canceled/refunded, exact diagnostic SKU/variant/quantity and shop currency. The response includes only aggregate counts and explicit false delivery/entitlement/payout flags. No customer name, email, address, order ID, provider token, raw GraphQL result, checkout or refund data is exposed by the route.

`GET /api/private/shopify-order-readback` is accessible only with an existing Gatehouse owner-session cookie (NOT a customer passwordless cookie) and `x-gatehouse-request: 1`. It **never** makes a provider call without BOTH `GATEHOUSE_SHOPIFY_READBACK_APPROVED=true` and a private, server-side `GATEHOUSE_SHOPIFY_ADMIN_ACCESS_TOKEN`. These values are **NOT set or installed by this PR**. No private key is copied out of Vault. The legitimate existing Hercules Shopify app must first complete its provider authorization; the current first-party provider registry lacks client, secret and access-token references. We intentionally do not substitute the ChatGPT Shopify connector token or existing internal scheduler/webhook keys.

This code does **not** mark orders as fulfilled, prove buyer identity or final financial settlement, associate purchase references with carts, or release paid reports. The $49 Gatehouse product remains Shopify DRAFT, and all customer signup/intake, report delivery and recurring subscription gates remain HOLD. Before activation, establish a provider-authorized, owner-reviewed secret transport from the existing Hercules Vault to the isolated runtime, document the access boundary and complete real paid buyer/report/refund verification. Existing hoodie/Titan/Studio checkout, DNS, payout settings and main branch must remain unchanged.

Tests exercise disabled authorization, unauthorized owner/customer access, full allowlisted shop verification, status/price/refund rejection, incorrect shop, provider errors and secret-redaction.

**Provider identity correction (verified):** A live authenticated read-only Shopify Admin `shop { id myshopifyDomain }` response returned shop GID `gid://shopify/Shop/100002726208` with original API domain `azymhc-x0.myshopify.com`. The historical Hercules provider connection's account key is `sauceapproved-2.myshopify.com` and the storefront primary domain is `sauceapproved.com`. These are different identifiers for the same intended business but must not be assumed equivalent without the pinned shop GID. The new reader uses the Shopify-attested original `myshopifyDomain` as its fixed Admin API host and validates the Shop GID again before accepting a response. It does not alter the existing provider connection, domain/DNS or published store.

## v2.2 — Duplicate-purchase-candidate and tenant-bound reservation

A new optional private database table `gatehouse_order_candidate_ledger` stores only a cryptographic HMAC of the Shopify order GID, a private pending intent ID, the authenticated owner and verified-site ID, the fixed `HG-DIAGNOSTIC-49` product unit value, and immutable `requires-provider-verification` status. No email, buyer name, raw Shopify order ID, public reference, access token, payment or diagnostic content is stored in this table. A future **privileged and separately approved backend service** may persist rows only after local candidate validation. This deployment creates no buyer intents, no ledger entries, no checkout or provider calls.

The ledger's unique order-hash and intent constraints reject duplicate correlations across buyers/claims **while the records are retained**. Its composite FK matches a specific purchase intent to exactly the same site and owner. Because it uses `ON DELETE CASCADE`, the ledger should not be represented as perpetual replay prevention after a privacy deletion; before entitlement activation an independently controlled verified fulfillment and idempotency ledger remains necessary. The table has RLS enabled and all permissions revoked from `anon` and `authenticated`; there are no public RLS policies or exposed browser requests. Never grant access to the browser or copy the HMAC secret into client code.

`preparePrivateOrderCandidate` uses the existing pending-intent/owner/verified-email/price/refund/order shape checks and never elevates that local comparison to trustworthy Shopify payment or verified-buyer proof. It always returns `deliveryAuthorized:false`, `customerEntitlementGranted:false`, `providerVerified:false`, and `checkoutEnabled:false`. No new endpoints are exposed. Installation on the existing database is additive, with no changes to the store, product status, checkout, payment provider, payout, DNS or other live services.

This milestone **does not solve** missing first-party Shopify Client Secret/authorized Admin token, customer identity enrollment/consent, secure report delivery, financial refund observation, or owner-approved legal policies. Gatehouse remains in DRAFT until all gates pass.

## v2.3 — Identity alignment and truthful unknown-count reporting (isolated review)

The legacy offline `checkOrderReadback` shape validator now requires the **original Shopify Admin-attested** `azymhc-x0.myshopify.com` domain, matching the existing pinned native Shopify reader. The historical `sauceapproved-2.myshopify.com` provider registry key and primary storefront `sauceapproved.com` are not substituted for that API identity. This local match is never independent payment, customer-identity or delivery evidence; `canFulfill` remains false.

When there is no authorized provider order readback, the public fulfillment readiness contract reports `actualCustomerOrdersVerified: null` rather than an invented verified count of zero. The separate real order-read route still requires legitimate owner/provider authorization. Data from the separate ChatGPT Shopify connector are not the Hercules backend's native, credential-attested order readback. The $49 product remains DRAFT and checkout, refund, payout and customer-report delivery remain locked. No SQL migrations, secrets, provider writes, DNS, billing or existing service changes are introduced by this patch.

## v2.4 — Reject test and incomplete Shopify order shapes (isolated local guard)

The **offline**, non-authoritative `checkOrderReadback` helper now requires `order.test === false` and `order.lineItemsPageHasNextPage === false` alongside its existing exact-shop, paid/status/refund, SKU/variant, and one-item checks. An absent or unknown test-mode or pagination value returns `unverified`, not a matching candidate. This blocks synthetic test orders and incomplete carts from being labeled local matches. No real Shopify token or order was used in development; a failing regression test first reproduced acceptance of `test:true` and the full Gatehouse suite rechecks the guard.

The flag `lineItemsPageHasNextPage` is explicitly **local input metadata**, not a new field of Shopify's GraphQL schema. A future server-side transformer must derive it from authenticated `lineItems.pageInfo.hasNextPage` and never trust browser values. Passing this local helper never authorizes fulfillment: `canFulfill:false`, checkout HOLD, and report delivery withheld. No database, authenticated provider connection, checkout, payouts, DNS, secret, or unrelated live service is changed.

## v2.5 — Bounded native Shopify order-page identity integrity

The **owner-only** native order reader now rejects any bounded Admin GraphQL order page containing a duplicate Shopify order GID, a missing order ID, or a noncanonical Shopify Order GID. A malformed response is reported as a generic `shopify-order-page-incomplete` error without returning order IDs, customer information, or credentials. Unique valid order IDs still produce the normal **candidate-only**, PII-free counts. The requested page remains capped at 10; no additional Shopify calls, pagination sweep or provider write was added.

Test-driven proof: newly added negative tests first failed on the previous reader, demonstrating that duplicates were counted twice and malformed IDs were accepted as success; the new validation fixes both cases. Importantly, a valid provider order page only proves bounded order readback, **not** buyer linkage, refund finality, payout or report authorization. The owner-only readback remains disabled unless the legitimate Shopify app token is privately configured and explicitly approved. This patch adds no credentials, database changes, checkout path or public delivery flow.


## v2.6 — Privileged, withheld buyer-to-Shopify candidate proposal (isolated)

New **private server-only** `private-buyer-order-reader.mjs` prepares a local HMAC-only order-to-intent reservation proposal from a deliberately bounded Shopify Admin read of the pinned original shop. It reuses the existing `preparePrivateOrderCandidate` logic; it does not create purchase intents or reservations in the database and **has no HTTP route** or scheduled task. No first-party provider token, owner session, or real customer order was used in tests.

The adapter requires explicit `enabled:true`, separate `ownerAuthenticated:true`, a valid private native Shopify Admin token, authenticated and tenant/site-matched private purchase intent, HMAC secret, and opaque buyer reference *before* contacting Shopify. No token or HMAC secret enters a browser. The GraphQL request (read-only, at most ten latest orders) includes customer email and the exact `gatehouse_intent_v1` custom attribute **only inside the private backend** to compare against the authenticated buyer identity, unexpired private intent, original product/variant, paid/no-refund/non-test status and single complete cart. Returned data never includes email, raw order IDs, cart attributes, buyer reference or the token. A positive result exposes only a seven-field private row proposal with a hashed order ID; there are **no database writes**.

The readback rejects wrong shop/domain, duplicate or invalid order GIDs and responses beyond the bound. Two distinct orders claiming the same intent are ambiguous, so it returns HOLD. No candidate in the latest ten orders is **not** proof there are no qualifying earlier orders; `allOrdersVerified:false` and `hasNextPage` communicate this limitation. Every possible outcome returns `providerVerified:false`, `buyerIdentityVerifiedByProvider:false`, `customerEntitlementGranted:false`, `deliveryAuthorized:false`, and `checkoutEnabled:false`. Even a native order shape with a matching reference is neither final payment/settlement evidence nor permission to fulfill.

**What this does not do:** There is no new owner/browser integration, new Shopify app, privileged service role grant, token export from the ChatGPT connector, public route, delivery system or release approval. Wiring it to a durable background workflow requires independent owner authorization of the existing Hercules Shopify app, backend-only credential custody, private data controls and validated buyer/report/refund/terms gates. Gatehouse remains DRAFT/HOLD; existing store checkout, payouts, DNS, services and main branch stay unchanged.


## v2.7 — Preflight private-intent identity and complete-order-history guard

The **private, disabled-by-default** buyer/order bridge now validates intent ownership, exact HMAC reference binding in constant time, pending status, 24-hour unexpired intent, confirmed email timestamp and email shape *before* making any privileged Shopify request. Expired, forged, future-dated, unverified, missing-hash or mismatched identities fail closed without contacting Shopify, unnecessarily retrieving unrelated customer data, or exposing a secret. An email address cannot be pre-verified against a historical Shopify purchaser without contacting the provider; the backend-only post-read match still checks that linkage.

A single matching order among the first ten is insufficient to create even a local private candidate if Shopify reports `orders.pageInfo.hasNextPage=true`: older unseen orders could claim the same intent. The response then reports `incomplete-provider-lookback`, `candidateMayBeRecorded:false`, `privateRow:null`, `allOrdersVerified:false`, and still denies checkout/entitlement/delivery. This remains a bounded maximum-one-page preview, **not** a full historical lookback, authorized live reconciliation, financial attestation, or buyer delivery. No new database tables, publicly callable endpoints, provider tokens, payment flows, or service permissions were added.


## v2.8 — Explicit protected customer email field access gate

Shopify's official protected-customer-data rules apply separately from a successful `read_orders` scope grant: the first-party Hercules app **may** need approved protected data access to retrieve `Order.email` for buyer matching. Access is unverified until the merchant app's protected data permissions and a legitimate read response are independently observed. GraphQL may return HTTP 200 with a field-level `errors` array (including `ACCESS_DENIED`) or redact inaccessible protected fields. Do not treat a 200 response as customer-email access evidence.

The **private server-only, default-disabled** buyer reconciliation adapter now returns a fixed, sanitized `shopify-protected-customer-email-unavailable` HOLD reason when a provider response clearly denies the email field. Other provider errors retain the generic shop-attestation failure; raw error messages, emails, order IDs, tokens, and buyer references are not echoed. A `null` email without GraphQL errors never matches buyer identity. These cases are regression tested with fake responses; no actual buyer data, protected-data approval, Shopify permission change, or live order lookup occurred.

Owner-controlled access review must follow Shopify's permitted protected-data request/review process, least privilege, and applicable privacy disclosures. Do not bypass permissions or substitute the separate ChatGPT Shopify connector's authorizations for native Hercules app access. No checkout, entitlement, report delivery, provider write, secret, public route, database or other existing live storefront change is introduced.

Official rules: https://shopify.dev/docs/apps/launch/protected-customer-data and https://shopify.dev/docs/api/admin-graphql/latest/objects/Order.

## v2.9 — Bounded cursor pagination retaining protected customer data checks

The **privileged, disabled-by-default and unrouted** private Shopify buyer/order reader can now paginate `orders(first: 10, after: $after)` across at most **three** Shopify Admin GraphQL pages (up to **30 order records**, not a complete historical scan). Each request uses the fixed original shop Admin endpoint, an owner-supplied private token, the same validated tenant-bound pending intent and a cursor returned by Shopify rather than browser input. Each page re-attests the canonical shop ID and domain. IDs must be canonical and unique **across all fetched pages**; repeated, missing, malformed or control-character cursors, malformed pages, and oversized pages fail closed. No provider mutation, publication, external dependency, credential prompt, public route, or database write.

A hashed candidate from page one is withheld until the query returns a final page. Two matching orders across pages are ambiguous and rejected. If Shopify still reports `hasNextPage=true` after the third page, the response remains `incomplete-provider-lookback` with `candidateMayBeRecorded:false`, `privateRow:null` and every checkout, entitlement and delivery gate false. Even if `hasNextPage=false` for the read query, final settlement, buyer ownership, refund finality, complete historical access and payout remain unverified: `allOrdersVerified:false` always.

Test-first cases cover a second-page candidate, three-page hard stop, cross-page order duplicates and conflicting references, invalid cursors, and single-page behavior, using only synthetic orders. First-party native Shopify authorization is still absent; this is not real buyer readback or a paid launch.


## v2.10 — Bound passwordless provider-call amplification

The **default-disabled** first-party customer authentication adapter now enforces a second, process-wide quota before calling the existing Supabase Auth provider: at most **20 email-code sends per 60 seconds** and **60 code-verification attempts per 15 minutes** in addition to its existing per-IP/address-and-email limits. Changing the recipient email, the connection address, or both cannot evade the aggregate quota within a single process. The quota resets with its fixed window, never triggers signup (`create_user:false`), and cannot grant report access or commerce. The origin/anti-CSRF requirements, authenticated session checks, HttpOnly cookies, and default-deny state remain unchanged.

**Important deployment constraint:** This is in-memory per instance, **not** a durable or distributed rate limiter. Multiple instances and restarts can reset it. Supabase Auth provider throttles, email sending configuration, and a shared persistent limiter are required if public login is later approved at scale. No real emails were sent in regression tests; all provider responses were simulated. Customer authentication, new account registration, report delivery, and the $49 checkout remain disabled until explicit approval and genuine end-to-end verification. No billing, production credentials, DNS, existing Shopify integration, or other live service is modified.

## v2.11 — Customer-site list tenant and response-integrity guard

The **disabled-by-default** authenticated customer-site list now treats every Supabase PostgREST response as untrusted, even when the REST query contains `owner_user_id=eq.<authenticated owner>` and RLS is configured. The read projects `owner_user_id` privately and checks that it exactly matches the verified Supabase Auth user for **each returned row**, rejects invalid or repeated site UUIDs, more than 25 rows, unsupported stage values, missing/invalid authorization dates, and noncanonical or unsafe website origins. Invalid responses fail closed with the same fixed storage-unavailable error; no customer site origin, record ID, or bearer token is returned. This retains the database's row-level authorization as the primary boundary and adds an independent output integrity check.

**Critical production-state limitation:** read-only Supabase privilege inspection during this milestone found authenticated SELECT privileges for the five relevant `gatehouse_customer_sites` columns **not granted**. The stronger site-list query therefore cannot be claimed to work against a live customer identity. This milestone does **not** change those grants, RLS, signup, authentication enablement, any customer data, paid checkout, payout, billing or report delivery. User-facing intake remains disabled by default; tests use synthetic provider responses only. Any later public opening requires explicitly approved, minimal column privileges, verified RLS and owner/customer authentication, plus paid-delivery authorization gates.


## v2.12 — Independent network witness for public readiness and anonymous private HOLD

The isolated Gatehouse GitHub Actions workflow now executes a **real external HTTPS smoke check** against the pre-existing free Render preview host after local Node tests. The first-party, read-only `hercules/gatehouse/live-smoke.mjs` is restricted to exactly one HTTPS origin and five pinned **GET** endpoints, with explicit no-redirect and 90-second timeouts. It sends no bearer token, cookie, customer identity, POST, provider secret, order or signup requests.

Three public responses must return 200 JSON with safe HOLD/readiness flags: `/health`, `/api/customer/portal-readiness`, `/api/customer/auth/capability`. Two **unauthenticated** private GET requests to `/api/private/shopify-order-readback` and `/api/customer/reports` must be rejected (401/503). Each failed check stops CI without logging the private response body or revealing credentials. The script emits a sanitized result, `verified-readonly-http-contract`, when all five succeed. Four new offline regression tests verify the request method/scope, HOLD flags, invalid public launch claims, unexpected anonymous private access and network failure handling.

**Actual evidence:** GitHub-hosted Actions runner successfully reached the deployed v2.11 preview and logged `{"status":"verified-readonly-http-contract","checks":5,"checkoutEnabled":false,"reportDeliveryEnabled":false,"providerOrderReadVerified":false}` on October 13, 2026 Eastern (October 14 UTC); Node's focused Gatehouse suite passed **162 tests, 0 failures** at the tested PR head. This proves those five HTTPS responses were observed independently, not that native Shopify owner authorization, purchased order integrity, payout, protected customer data scope, browser sign-in, customer delivery, or refund is verified. The HTTP checks are CI-only, not continuous monitoring; a later deployment must be tested again to extend this evidence to a newer version. No customer/payment/report flow, DNS, payout, production store or hosting plan is altered.


## v2.13 — Embedded Shopify ID-token exchange lab (not authorized or connected)

The **existing Hercules Shopify app is embedded** (`shopify/hercules/shopify.app.toml` has `embedded = true`) and the first-party owner Integrations page loads Shopify App Bridge. Shopify’s documented embedded-app path is **App Bridge `shopify.idToken()` followed by server-side ID-token validation and token exchange**. The currently deployed provider action uses client credentials only, which Shopify limits to shops/apps in the same organization; this new **private lab** prepares the official embedded alternative without attempting to bypass Shopify permission grants. Official primary source: https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange .

The isolated, first-party `embedded-shopify-grant.mjs` is **not imported by the live server, not exposed as a public route, not wired to Supabase Edge Functions, and disabled by default**. It requires external proof of authenticated owner authority and the legitimate **matching Shopify app secret**, validates the Shopify ID token’s HS256 signature, pinned exact audience, `iss`/`dest` HTTPS shop identity, time-limited `exp/iat/nbf`, then requests the fixed Shopify endpoint’s **expiring offline token** with `read_orders`. It checks for both short-lived access **and** private refresh tokens, validates the pinned Shopify shop GID/domain and a single read-only `orders(first:1)` response, and calls an **injected private storage callback** only when all guards pass. Results cannot contain raw ID/access/refresh tokens, private buyer data or errors. No checkout, refunds, order mutations, product publication, entitlement, report delivery or payout authority is generated.

**Integration still required and not authorized:** The real Supabase backend would have to (1) verify owner Supabase identity and Shopify merchant session; (2) retrieve the matching app secret from privileged backend custody, never the page or chat; (3) implement a transactional, owner/organization-scoped Supabase Vault write for both access and refresh credentials; (4) implement authenticated, bounded refresh-token rotation and revocation handling; (5) independently prove Shopify’s existing app installation/scopes, and any protected customer-data permissions for buyer email. No such backend connection, user session, live Shopify grant, Vault write, release decision, additional billed service or provider settings change occurred in v2.13. Synthetic tests exercise the trust boundaries only.


## v2.14 — Isolated Shopify expiring-offline refresh with exclusive private-lease and CAS contract

The default-disabled, **never-mounted** `embedded-shopify-refresh.mjs` adds a first-party, server-only *integration contract* for Shopify's documented `grant_type=refresh_token` flow. A future privileged backend worker must verify its own authority and the pinned Hercules organization, hold the genuine matching Shopify client secret in trusted server custody, and provide a **durable, exclusive per-organization credential lease** containing the current expiring offline refresh token and its private access-token/refresh-token expiry times. This module does not create the lease or read/store credentials by itself. It is not imported by the live Render service or connected to the deployed Supabase Edge Function.

For an access token still valid more than 60 seconds, the module does **zero** Shopify requests and safely releases the lease. When refresh is due it sends **one** fixed-host Shopify OAuth token-refresh POST and requires a newly rotated expiring access/refresh token pair, an explicit `read_orders` scope, and bounded expiry metadata. It then runs **one** fixed-shop and `orders(first:1)` Admin GraphQL attestation request; provider errors, mismatched shop ID/domain, or omitted `read_orders` all fail closed. The injected lease must perform **atomic comparison-and-swap** of both confidential token references using the exact previous generation. Only an explicit `{stored:true,generation:<next>}` receipt permits a sanitized `refreshed-in-private-vault` result. The private lock must be released even on error; no token, buyer information, secret, or raw provider error may appear in an external response.

A Shopify **401** means `reauthorization-required` (merchant must reopen the authenticated installed app). A transient **429, 5xx or network failure** means `retry-later`, with **no automatic retry in the same invocation**. All other invalid states HOLD. This prevents unsafe silent launch claims: successful refresh is *not* proof of paid buyer identity, payout settlement, customer report fulfillment, or permission to enable checkout.

**Scope limitations:** This work uses only synthetic credentials and callbacks. The organization-exclusive lease, generation-checked **transactional Supabase Vault writer**, persistent metadata, actual refresh-token rotation/revocation and merchant session must still be implemented and verified within a separately authenticated first-party backend. Do not expose this module as a public HTTP route, add credentials to repository/files/logs, grant direct anonymous or user SQL access, combine refresh with concurrent ID-token acquisition, or apply database migrations without security review. No Supabase schema, Shopify application permissions, product publishing, billing, production payout, DNS or Render server code was changed. The code is original first-party Node with no new dependency. Documentation: https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange and https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens.
