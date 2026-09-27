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
- Owner authentication is server-side using an HttpOnly, Secure, SameSite=Strict cookie. The owner key is never shipped to client JavaScript.

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

Opera is not a dependency. Hercules Browser can be opened directly as its own installed application, while Hercules services can also drive the same browser runtime through the server-side API.

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
