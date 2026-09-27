# Hercules Launch Auth & Security Review — 2026-09-27

## Current result

The production technical launch gate is green, but the launch approval `auth_hardening` must remain pending.

The current Supabase security advisor reports two warning classes relevant to launch:

1. leaked-password protection is disabled;
2. two authenticated RPCs are SECURITY DEFINER functions.

## Leaked-password protection

**Status:** launch blocker

Supabase currently reports `auth_leaked_password_protection` as a warning.

Hercules uses email/password authentication on the launch surface. Until compromised-password rejection is enabled, `auth_hardening` must not be approved.

Supabase documents leaked-password protection as an Auth password-security control that rejects passwords found in the Have I Been Pwned password corpus. For hosted Supabase projects it is configured in Auth settings and is available on the Pro plan and above.

### Required verification

After the setting is enabled:

1. rerun the production Supabase security advisor;
2. require `auth_leaked_password_protection` to disappear from active warnings;
3. retain the passing advisor evidence;
4. only then mark `auth_hardening` approved.

## SECURITY DEFINER warnings

Supabase currently reports:

- `public.hercules_bootstrap_organization(org_name text, org_slug text)`;
- `public.hercules_chat_current_usage()`.

These functions are intentionally callable by the `authenticated` role and are not callable by `anon`.

### hercules_bootstrap_organization

The function is intentionally SECURITY DEFINER because it performs controlled workspace bootstrap that needs access beyond an ordinary authenticated client.

Current controls include:

- requires `auth.uid()`;
- rejects anonymous callers;
- requires a confirmed email;
- validates the requested slug;
- gates new public workspaces on the latest Hercules launch gate;
- allows existing active members to continue;
- preserves the isolated synthetic onboarding-certification path;
- protects the reserved `sauceapproved` organization slug with an owner-claim check.

This advisor warning is therefore an intentional privileged RPC boundary, not evidence that arbitrary authenticated users receive unrestricted database access.

### hercules_chat_current_usage

The function is intentionally SECURITY DEFINER so the authenticated user can read their own usage summary across protected billing/usage tables.

Current controls include:

- derives identity only from `auth.uid()`;
- filters billing, usage, and ledger rows to that user ID;
- returns no rows if no authenticated user exists;
- is not executable by `anon`.

This remains an intentional least-surface usage RPC.

## RLS enabled with no policy

The advisor also reports many INFO findings where RLS is enabled and no client policy exists.

For internal/control-plane tables this is fail-closed behavior for ordinary client roles: RLS is enabled but no direct client row-access policy is granted.

Do not create broad policies solely to clear INFO findings. Add a policy only when a real customer-facing access path requires one, and scope it to the appropriate user, membership, organization, role, and operation.

## Launch decision

`auth_hardening` remains **pending** because leaked-password protection is still disabled.

The two SECURITY DEFINER warnings are documented as intentional boundaries with identity scoping and do not, by themselves, change the launch gate.

No security warning should be dismissed merely to make a dashboard green; production behavior and evidence control the decision.
