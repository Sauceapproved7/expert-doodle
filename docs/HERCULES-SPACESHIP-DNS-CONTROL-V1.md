# Hercules Spaceship DNS Control v1

Date: 2026-09-27 UTC

## Purpose

Turns the merged Spaceship → Shopify DNS adapter into an operator-ready, server-side Hercules control surface without putting registrar credentials in browser sessions, source control, logs, or client code.

The control is intentionally fixed to `sauceapproved.com`.

## Architecture

`operator -> service-role SQL bridge -> Supabase Edge Function -> canonical Hercules Spaceship DNS adapter -> Spaceship External API`

The Edge Function bundle carries an exact CI-verified copy of the canonical `hercules-deploy/spaceship-dns.mjs`. The test gate fails if those files drift.

## Credential custody

Two registrar values are required once:

- Spaceship External API key
- Spaceship External API secret

They are stored in Supabase Vault. The public credential registry stores only Vault UUID references.

A separate random Hercules internal-control key is generated inside the database during migration, stored in Vault, and represented in `hercules_internal_service_keys` only by its SHA-256 plus secret reference.

No credential value is returned by the provisioning function.

## Least privilege

The Spaceship API credential should have only:

- `dnsrecords:read`
- `dnsrecords:write`

No billing, transfer, contact, registration, or nameserver-management authority is needed.

## Supported operator actions

### Inspect

`public.hercules_spaceship_dns_submit('inspect', false)`

Reads the complete paginated zone and returns only the Shopify web-routing state, conflicts, and missing-record count.

### Reconcile

`public.hercules_spaceship_dns_submit('reconcile', <replace custom conflicts>)`

The Edge Function:

1. reads the complete zone;
2. fails closed on provider-managed or unknown ownership conflicts;
3. refuses to delete custom conflicts unless replacement was explicitly authorized;
4. saves only missing Shopify A, AAAA, and `www` CNAME records;
5. re-reads the complete zone;
6. requires exact post-write verification.

The existing adapter preserves unrelated mail, TXT, verification, and subdomain records.

## Current live boundary

Infrastructure can be deployed before registrar credentials exist. Until credentials are provisioned, operator requests return `spaceship_credentials_not_configured` and make no DNS changes.

After DNS verifies, Shopify still needs to accept/verify the existing domain and provision SSL before the apex should become primary.
