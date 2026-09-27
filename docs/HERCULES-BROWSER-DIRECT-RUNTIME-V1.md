# Hercules Browser Direct Runtime v1

Date: 2026-09-27  
Status: **verified rollback implementation; not the canonical production worker**

## Purpose

The direct runtime was built to remove Browserless/CDP from the Hercules critical path while the canonical Gateway v2 implementation was being completed.

It launches Playwright-managed Chromium and exposes the bounded worker contract consumed by `hercules-browser`: `navigate`, `scrape`, `screenshot`, `interact`, and `close_session`.

## Production disposition

The direct service was deployed and verified successfully, including LinkedIn navigation to the legitimate authentication surface, a six-request production burst with 6/6 success, and Browser Agent convergence from Example Domain to IANA.

After PR #268, `hercules-browser-gateway-v2` became the canonical production worker because it keeps the same local-Chromium safety model while reusing an owned Chromium process across isolated contexts.

The direct service remains the first rollback target in the production worker registry. Browserless-backed services are legacy rollback material only.

## Security properties

- bearer-token authentication is mandatory for `/v1/run`;
- token material is runtime/Vault-backed and not committed;
- HTTP(S) targets are checked before navigation;
- localhost, link-local, RFC1918/private IPv4, loopback, unique-local IPv6, `.local`, and `.internal` targets are blocked;
- DNS answers are checked for private-address resolution;
- subresource requests use the same public-network checks;
- raw JavaScript/code execution is not exposed;
- CAPTCHA, MFA, provider login, consent, and anti-bot systems are not bypassed;
- opaque browser sessions expire after ten minutes.

## Render deployment contract

Build command:

```sh
cd render/hercules-browser-direct && npm install --omit=dev && node node_modules/playwright-core/cli.js install chromium
```

Start command:

```sh
node render/hercules-browser-direct/server.mjs
```

Required environment:
- `HERCULES_DIRECT_TOKEN` — Vault-backed worker bearer token.
- `PLAYWRIGHT_BROWSERS_PATH=0` — required on Render so Chromium is packaged in the deployed artifact instead of only the transient build cache.

Do not promote this service back to primary without an explicit rollback reason and fresh production verification.
