# Hercules Mobile Ops (staging)

Mobile-first read-only operations console for iPhone, Android, and desktop. No SSH port or paid Render plan needed for the read-only status view.

## Deployed surfaces

- `https://hercules-mobile-api-staging.onrender.com/` — operational console and same-origin API.
- `https://hercules-mobile-control-preview.onrender.com/` — static preview; directs users to the API for checks.
- `GET /api/ops` — bounded public HTTP snapshots of an explicit allowlist of Hercules web services, cached for 60 seconds. HTTP timeouts on Render Free are `unconfirmed`, not definitive outages.
- `GET /health` — existing API liveness probe.

## Included controls

1. **Service check:** manually request read-only HTTPS probes of five explicitly listed public Render URLs, never arbitrary user-selected hosts. Redirect following is disabled. Responses are classified as `healthy`, `responding`, `protected`, `limited`, `degraded`, or `unconfirmed` and never include response bodies.
2. **Diagnostic handoff:** copy the dated service results to share with authorized developers or support. No credentials are collected.
3. **Task preparation:** copy bounded task instructions for approved workflows; direct browser and management links.

## Security boundary

- GET `/api/ops` is public and intentionally contains only public URLs and public HTTP response codes. It uses no Render, GitHub, Shopify, or Stripe credentials. Health polling is user-initiated, with server-side caching to reduce expensive instance wake-ups. No user-supplied URL is accepted.
- The staging service serves its own same-origin UI. The UI retains a strict `connect-src 'self'` CSP, disallows embedding, and uses DOM `textContent` instead of inserting HTML from server responses.
- `POST /tasks` and `/status` retain their existing bearer-token authentication. Codex execution is off unless a server-side executor is separately registered and authorized. No bearer token is stored in HTML, JavaScript, or browser storage.
- No command execution, full shell, checkout, production deployment, provider setting edits, or protected account data access is implemented.
- Read-only HTTPS checks **do not** establish real deployment state, revenue, payment success, delivery, payout readiness, or app-level readiness.

## Tests

```sh
python -m unittest discover -s tests -p 'test_hercules_mobile_*.py' -v
```

No actual external health calls are made in regression tests. To deploy on the existing Render staging service, update its existing feature branch then trigger the service's explicit deployment (auto-deploy currently off). Production services and default branch remain unchanged until separate review and authorization.
