# Hercules Browser Standalone Auth Broker v1

## Purpose

The standalone Hercules Browser must run independently without Opera and without copying long-lived secrets into Render.

## Authentication model

Hercules uses one-time broker tokens:

1. Supabase generates 256-bit random tokens.
2. Only SHA-256 hashes are persisted in the private schema.
3. Runtime tokens expire quickly and are atomically consumed on verification.
4. Supabase dispatch sends the raw token directly to the standalone browser inside the database-side HTTP request.
5. Render calls a narrow PostgREST RPC using only the public Supabase URL and publishable client key.
6. The RPC validates token format and delegates to the service-role-only atomic consume function. Replay fails.
7. The private token ledger remains inaccessible to anon/authenticated roles.
8. Render stores no Hercules runtime bearer secret.

Owner UI access uses the same broker with purpose `owner`. After a valid one-time claim, Render creates a local random browser session and sets it as an HttpOnly, Secure, SameSite=Strict cookie.

## Autonomous execution

`hercules_browser_standalone_dispatch` permits only these browser API paths:

- `/api/autopilot`
- `/api/navigate`
- `/api/action`
- `/api/new-session`

This lets Hercules run complete browser plans without the operator opening Opera or moving credentials between systems.

Provider-controlled identity and consent boundaries remain fail-closed: passwords, MFA/OTP, CAPTCHA, legal terms, and provider consent are never fabricated or bypassed.


## Function-limit fallback

The project is at its Edge Function count limit, so the verifier does not consume an additional Edge Function slot. The public RPC is intentionally narrow: it accepts only a 64-hex opaque token, returns only verification status/purpose, uses a fixed search path, and has no direct query that exposes private token rows.
