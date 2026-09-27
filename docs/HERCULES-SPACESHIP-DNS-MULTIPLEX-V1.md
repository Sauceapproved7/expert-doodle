# Hercules Spaceship DNS Multiplex v1

Date: 2026-09-27 UTC

## Reason

The Supabase project reached its current Edge Function count limit. Hercules therefore reuses the existing `hercules-private-bridge` function slot instead of deleting a live function, upgrading the plan, or weakening the DNS control design.

## Route

The existing private-bridge owner/admin API remains intact.

A POST carrying the private `x-hercules-internal-key` header is routed to the Spaceship DNS control module. That module independently validates the SHA-256 of the internal key against `hercules_internal_service_keys` before any registrar credential is read or any provider call is attempted.

The database operator function `hercules_spaceship_dns_submit()` now posts to:

`/functions/v1/hercules-private-bridge`

No new Edge Function slot is consumed.

## Safety

- `sauceapproved.com` remains the only default allowed registrar domain.
- Registrar credentials remain Vault-only.
- Existing private-bridge user flows keep their owner/admin authentication.
- Provider-managed or unknown DNS conflicts fail closed.
- Custom target conflicts require explicit replacement authority.
- Unrelated mail/TXT/verification records are preserved.
