# Hercules Browser Standalone v1

## Product

Hercules Browser is a standalone SauceApproved browser product. It does not depend on Opera, an Opera connector, or another desktop browser to execute normal web workflows.

The service owns its Chromium runtime through Playwright and exposes an installable PWA for phone and desktop.

## Architecture

- Render-hosted Node service.
- Local Chromium launched by Playwright.
- Hardened network policy blocks private/internal targets, unsupported protocols, and embedded URL credentials.
- Long-lived isolated browser session with automatic cleanup.
- Live browser surface delivered as screenshots with bounded click, key, text, scroll, back, forward, and reload controls.
- Installable PWA shell with offline application assets.
- Owner authentication is server-side using an HttpOnly, Secure, SameSite=Strict cookie.
- Initial owner bootstrap uses a URL fragment that is POSTed once over TLS and scrubbed from browser history, so the bootstrap secret is not sent in request URLs, referrers, or Render access logs.
- Server-to-server automation uses a fresh one-time Vault-backed broker token with runtime purpose.
- Neither the owner key nor the runtime token is shipped to client JavaScript.

## Owner handoff and memory recovery

An owner link may include `start=<encoded HTTP(S) destination>` in its fragment alongside the one-time access token. The client removes the fragment from history, retains only the non-credential destination in tab session storage, and opens it through the authenticated navigation endpoint when the browser page is blank. A page already opened by the owner is preserved. Navigation failures are displayed and automatic retries are bounded.

The 512 MiB deployment allows one Chromium context. Parallel owner status/frame requests share the same pending context creation. Idle worker contexts are closed before replacement; active requests and the owner page are protected. Transient workers remain counted until their request finishes. Unknown worker session IDs return `session_expired` instead of opening an unrelated blank page. Requests that would exceed capacity return `browser_capacity_busy`.

Owner browser contexts retain the existing 24-hour idle limit; worker contexts expire after five idle minutes. A full service restart still clears in-memory login/cookie state and requires a fresh owner authorization link. Saved task navigation is not a substitute for provider authentication or human verification, and a single large page can still exceed the deployment's memory limit.

Regression checks:

```sh
node --test tests/hercules-browser-standalone*.test.mjs
```

## Autonomous execution

The server provides a bounded autopilot API.

Each intent carries:
- intentId
- resumeToken
- completed step count
- retry count
- lastCheckpoint
- terminal status

Autopilot can perform normal navigation, clicks, non-secret field fills, key presses, waits, and scrolling without owner interaction.

It fails closed when it encounters:
- password fields
- one-time-code / OTP controls
- MFA / 2FA
- CAPTCHA or human verification
- acceptance of legal terms
- provider authorization or consent

Those boundaries are deliberately not bypassed or fabricated.

## Independence

Opera is not a dependency. Hercules Browser can be opened directly as its own installed application, while Hercules services can also drive the same browser runtime through the server-side API using the separate runtime credential. No Opera extension or browser connector is required.

## Security

- No raw JavaScript execution endpoint.
- No cookie export.
- No localStorage/sessionStorage credential export.
- No anti-bot bypass.
- No CAPTCHA bypass.
- No Cloudflare bypass.
- No private-network browsing.
- No embedded URL credentials.
- Client never receives the server owner key.
