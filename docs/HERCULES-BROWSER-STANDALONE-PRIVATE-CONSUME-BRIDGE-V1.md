# Hercules Browser Private Consume Bridge v1

## Purpose

The first SECURITY INVOKER remediation removed privilege elevation from the public verifier but the live anonymous PostgREST test showed RLS prevented every token row from being visible to UPDATE.

This revision keeps the public API surface invoker-only without granting the anonymous role token-table access.

## Design

- `public.hercules_browser_standalone_token_consume_public` remains `SECURITY INVOKER`.
- `anon` and `authenticated` receive no privileges on `private.hercules_browser_standalone_tokens`.
- The temporary anon RLS update policy is removed.
- Atomic token consumption moves to `private.hercules_browser_standalone_token_consume_bridge`.
- The private helper is `SECURITY DEFINER` with a fixed search path and is outside the exposed PostgREST schemas.
- `anon` receives only schema USAGE and EXECUTE on that exact private helper.
- The helper accepts only a 64-hex opaque token, hashes it, updates only a matching unconsumed/unexpired row, and returns only purpose/expiry.
- Replay remains impossible because the first successful consume sets `consumed_at`.

## Verification requirement

Production verification must use the real anonymous PostgREST RPC path and race the same one-time token twice. Exactly one response must report `ok=true`; the other must report `token_invalid_expired_or_consumed`. The autonomous Supabase-to-browser dispatch must also pass afterward.
