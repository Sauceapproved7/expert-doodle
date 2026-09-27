# Hercules Authenticated SECURITY DEFINER Retirement v1

Date: 2026-09-27 UTC

## Purpose

Remove direct authenticated execution from the final two `SECURITY DEFINER` RPCs reported by the production Supabase security advisor, without weakening their authorization behavior.

The affected client-facing RPCs were:

- `public.hercules_bootstrap_organization(text,text)`;
- `public.hercules_chat_current_usage()`.

Both were intentionally identity-scoped, but direct `authenticated` execution left a broader privileged-RPC surface than necessary.

## Organization bootstrap

A new service-role-only function, `hercules_bootstrap_organization_internal(uuid,text,text)`, preserves the existing controls:

- verified authenticated user ID supplied by the server-side launch Edge Function;
- confirmed email required;
- slug validation;
- public registration and launch-gate enforcement;
- existing-member continuation;
- isolated synthetic onboarding certification path;
- reserved `sauceapproved` slug owner-claim protection.

The public Hercules launch page no longer calls the privileged RPC directly. It POSTs to its own Edge Function, which validates the bearer session against Supabase Auth and then invokes the service-role-only internal function with the verified user ID.

## Chat usage

A new service-role-only `hercules_chat_current_usage_internal(uuid)` computes usage for one explicit user ID.

The `hercules-chat` Edge Function already runs with JWT verification enabled. Its `usage` action now passes the gateway-verified user ID to the internal function using the service role.

Billing, usage, and private ledger rows remain filtered to that one user.

## Legacy functions

The old function definitions remain present for migration/history compatibility, but execution is revoked from:

- `public`;
- `anon`;
- `authenticated`.

No browser client or authenticated PostgREST caller needs those privileged functions anymore.

## Expected security effect

After deployment, the Supabase advisor's `authenticated_security_definer_function_executable` warnings for these two functions should disappear.

This change does **not** resolve leaked-password protection. `auth_hardening` must remain pending until that independent Supabase Auth setting is enabled and the production advisor confirms the warning is gone.
