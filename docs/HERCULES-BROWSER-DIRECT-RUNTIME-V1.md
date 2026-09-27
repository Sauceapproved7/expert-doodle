# Hercules Browser Direct Runtime v1

Date: 2026-09-27

## Purpose

Remove Browserless/CDP as a required dependency for the owned Hercules Browser production path.

The direct runtime launches its own Playwright-managed Chromium process and exposes the same bounded worker contract already consumed by `hercules-browser`:

- `navigate`
- `scrape`
- `screenshot`
- `interact`
- `close_session`

## Security properties

- Bearer-token authentication is mandatory for `/v1/run`.
- The token is supplied at runtime and is not committed to source.
- HTTP(S) targets are checked before navigation.
- Localhost, link-local, RFC1918/private IPv4, loopback, unique-local IPv6, `.local`, and `.internal` targets are blocked.
- DNS answers are checked so public hostnames resolving only to private addresses are rejected.
- Subresource requests pass through the same public-network allow check.
- Raw JavaScript/code execution is not exposed.
- CAPTCHA, MFA, provider login, consent, and anti-bot systems are not bypassed.
- Browser sessions can be reused only by an opaque session ID and expire after ten minutes.

## Why this exists

During live DA-24 LinkedIn verification on 2026-09-27, the three owned Browserless-backed endpoints failed at the CDP layer with connection timeouts or a public-edge 429/Cloudflare response. A separate Hercules screenshot path had already proven that the LinkedIn route itself reached the legitimate LinkedIn sign-in surface.

The direct runtime removes that infrastructure dependency while keeping the same authorization and browser safety boundaries.

## Deployment contract

Render build command:

```sh
cd render/hercules-browser-direct && npm install --omit=dev && node node_modules/playwright-core/cli.js install chromium
```

Render start command:

```sh
node render/hercules-browser-direct/server.mjs
```

Required runtime environment:

- `HERCULES_DIRECT_TOKEN`: Vault-backed worker bearer token.

The production `hercules_browser_workers.primary` row is cut over only after the direct runtime is deployed and verified.
