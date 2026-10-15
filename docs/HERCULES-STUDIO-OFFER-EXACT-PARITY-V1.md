# SauceApproved Studio offer: exact-public-artifact parity witness

This is a read-only, no-token verifier for the merged **Studio founding-access offer page**, not the separate Studio application and not a publishing tool.

## Source and fixed destinations

- Canonical source: `hercules-forge/offers/sauceapproved-studio/index.html`.
- Public Supabase Storage object: `hercules-sites/ea5fb196-67f9-42fa-b592-49eeb3b84346/sauceapproved-studio-offer/index.html`.
- Render presentation: `https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/`.
- Excluded product: `https://sauceapproved-forge-host.onrender.com/sauceapproved-studio/` — the distinct, already-live Studio application.

## Run

Offline tests, no HTTP requests:

```sh
node --test tests/hercules-studio-offer-parity.test.mjs
```

Explicit read-only release observation from an authorized repository checkout:

```sh
node scripts/hercules-studio-offer-parity.mjs --probe --json
```

The verifier reads the checked-out canonical offer source, validates required accessibility and commercial-boundary markers, hashes its UTF-8 bytes, then makes exactly two unauthenticated public GET requests. Requests never send cookies or secrets, never follow redirects, time out within 8 seconds each, and refuse bodies larger than 64 KiB. Results contain hashes and status only, not public HTML contents.

A successful report requires **both public endpoints to deliver byte-identical HTML with a valid HTML content type** to the checked-out source. If a public endpoint responds with a non-HTML MIME type, the verifier still computes a bounded SHA-256 of its bytes for drift diagnosis, but reports that endpoint as `not_verified` with `unexpected_content_type`, even if the bytes match. An HTTP 200 by itself is insufficient; partial matches, redirects, fetch failures, larger payloads, and application HTML instead of offer HTML report `unverified_or_drifted`. Run against the exact desired Git commit, not an unspecified future checkout.

## Important evidence limits

- The witness is strictly read-only: `publish=false`, `approve=false`, `charge=false`.
- Exact HTML parity does **not** prove a legitimate release was authorized, a buyer can pay, a request is delivered, or that a whole application works.
- A mismatch indicates an unverified version difference, **not automatic permission to overwrite the live object**.
- A matching source and public destination at one moment does not prove CDN cache invalidation everywhere or authenticated user journeys.
- The implementation-enforcement CI runs *offline tests only*. Separately, `.github/workflows/hercules-studio-offer-public-artifact-audit.yml` intentionally makes two bounded, no-credential public GET requests on pull requests that change this verifier, its tests, workflow, documentation, or offer HTML. Its probe step is `continue-on-error` so an expected stale public artifact does **not** falsely block security CI or imply deployment. Read the probe JSON and summary rather than interpreting the overall job's green status as parity success.

## Existing Hercules release route

Existing `hercules-deploy-controller` supports a controlled `deploy_static` request that stores HTML into `hercules-sites`, via `putPresentation(slug, html)`. It requires an authorized owner/admin session or an approved internal-service request, and broader release workflows require their own signed admission gates. This witness does **not** create a bypass, credentials, token relay, or new server-side authorization.

The intended publishing slug is `sauceapproved-studio-offer`; do not publish to `sauceapproved-studio`. Before publishing, verify the permitted release state, preserve a rollback copy, match the submitted HTML to the exact committed source SHA and bytes, and keep checkout, pricing, payouts, legal policies, DNS, Shopify, and WordPress unchanged. Record release identity and confirm exact bytes through both endpoints after the authorized action.

## Ownership and provenance

New original SauceApproved/Hercules JavaScript and tests, AI-assisted, October 14, 2026. Uses Node built-in crypto/fs only; no third-party code, packages, binary downloads, secrets, model weights, user data or outside service fees. It adds no production permissions.

Tracking: [Studio offer release #1065](https://github.com/Sauceapproved7/expert-doodle/issues/1065).
