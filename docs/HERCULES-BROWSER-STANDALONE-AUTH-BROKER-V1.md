# Hercules Browser Standalone Auth Broker v1

## Purpose

The standalone Hercules Browser must run independently without Opera and without copying long-lived secrets into Render.

## Authentication model

Hercules uses one-time broker tokens:

1. Supabase generates 256-bit random tokens.
2. Only SHA-256 hashes are persisted in the private schema.
3. Runtime tokens expire quickly and are atomically consumed on verification.
4. Supabase dispatch sends the raw token directly to the standalone browser inside the database-side HTTP request.
5. Render calls the dedicated Supabase verifier Edge Function.
6. The verifier consumes the token through a service-role-only RPC. Replay fails.
7. Render stores no Hercules runtime bearer secret.

Owner UI access uses the same broker with purpose `owner`. After a valid one-time claim, Render creates a local random browser session and sets it as an HttpOnly, Secure, SameSite=Strict cookie.

## Autonomous execution

`hercules_browser_standalone_dispatch` permits only these browser API paths:

- `/api/autopilot`
- `/api/navigate`
- `/api/action`
- `/api/new-session`

This lets Hercules run complete browser plans without the operator opening Opera or moving credentials between systems.

Provider-controlled identity and consent boundaries remain fail-closed: passwords, MFA/OTP, CAPTCHA, legal terms, and provider consent are never fabricated or bypassed.
