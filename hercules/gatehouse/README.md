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
