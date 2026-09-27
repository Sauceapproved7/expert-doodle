# Hercules Trigger Function Lockdown v1

Date: 2026-09-27 UTC

## Purpose

Remove two externally callable SECURITY DEFINER trigger functions from the Supabase RPC surface without changing the trigger behavior they perform internally.

## Functions locked down

- `public.hercules_sync_shopify_launch_readiness_from_domain()`
- `public.hercules_sync_storefront_smoke_to_launch_readiness()`

Both functions are trigger implementation details. They synchronize verified production state after database events and are not intended to be user-invokable RPC endpoints.

## Change

Direct EXECUTE permission is revoked from:

- `public`
- `anon`
- `authenticated`

`service_role` retains execute permission.

The existing triggers remain installed and continue invoking the functions normally.

## Security effect

This removes the Supabase security-advisor findings that anonymous or signed-in users could directly invoke these SECURITY DEFINER functions through `/rest/v1/rpc/...`.

No launch state, storefront state, DNS state, Shopify state, or credential data is changed by this migration.
