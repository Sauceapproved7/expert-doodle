# Hercules Spaceship Owner Connection v1

Date: 2026-09-27 UTC

## Purpose

Provide a secure owner/admin authorization path for connecting the already-owned `sauceapproved.com` domain at Spaceship to the SauceApproved Shopify store without exposing registrar credentials in chat, source control, client logs, or browser automation.

This complements the canonical DNS adapter in `hercules-deploy/spaceship-dns.mjs`.

## Why this path exists

Hercules Browser remains the default browser execution path. The live browser reached Spaceship, but Spaceship presented a Cloudflare human-verification challenge. Hercules does not automate or bypass that control.

The supported fallback is Spaceship's documented External API with least-privilege DNS permissions.

## Owner page

The Edge Function `hercules-spaceship-connect` serves a small owner connection page.

The page:

- reuses the existing Hercules Supabase session on the same origin;
- allows only an authenticated Hercules owner/admin to submit credentials;
- uses a password field for the API secret;
- clears the key and secret fields immediately after successful connection;
- never returns either credential to the browser;
- refuses framing and disables caching.

The function is deployed with platform JWT verification disabled only because GET must serve the owner page before a request header exists. Every state-changing POST performs explicit Supabase user authentication plus active owner/admin membership enforcement.

## Spaceship permission boundary

The credential should have only:

- `dnsrecords:read`
- `dnsrecords:write`

No domain registration, purchase, transfer, billing, contact, nameserver, or account-security permission is required.

The function validates the credential against `sauceapproved.com` before storing it in Hercules Vault.

## Stored credential model

`hercules_provider_connections` gains the explicit provider value `spaceship`.

For the SauceApproved connection:

- `provider = spaceship`
- `account_key = sauceapproved.com`
- API key -> Vault secret referenced by `secret_ref`
- API secret -> Vault secret referenced by `access_secret_ref`

The plaintext values are not stored in provider metadata or returned by status APIs.

## DNS reconciliation

The owner may trigger `reconcile_shopify` after credentials validate.

The function manages only:

- A `@` -> `23.227.38.65`
- AAAA `@` -> `2620:0127:f00f:5::`
- CNAME `www` -> `shops.myshopify.com`

Safety rules:

1. read the complete Spaceship DNS zone;
2. preserve unrelated records;
3. accept an existing exact Shopify record;
4. refuse conflicts owned by a Spaceship product, personal nameservers, or unknown ownership;
5. replace conflicting custom records only after the explicit owner action;
6. write missing Shopify records without `force`;
7. read the zone again and require exact verification;
8. mark the corresponding Hercules desired records active only after verification.

The function does not mark the domain ownership-verified or Shopify-primary. Those states require their own verification.

## Remaining launch sequence

After DNS verifies:

1. add/verify `sauceapproved.com` in Shopify;
2. wait for Shopify SSL/domain verification;
3. make the custom domain primary only after verification succeeds.

## Ownership boundary

The Edge Function, migration, tests, connection UI, reconciliation policy, audit handling, and Hercules integration are SauceApproved/Hercules repository-controlled source.

Spaceship, its External API, Cloudflare, Shopify, DNS infrastructure, and Supabase remain external infrastructure and are not represented as SauceApproved-owned technology.
