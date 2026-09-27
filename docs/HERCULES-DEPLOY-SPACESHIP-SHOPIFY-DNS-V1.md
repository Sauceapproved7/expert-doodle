# Hercules Spaceship → Shopify DNS Adapter v1

Date: 2026-09-27 UTC

## Purpose

Provide a narrow, owner-code Hercules adapter for connecting the SauceApproved registrar DNS zone to Shopify without browser automation or third-party automation credits.

The adapter talks to the official Spaceship External API as an external infrastructure boundary. No Spaceship SDK or vendor source is packaged in Hercules.

## Target

Allowed production domain by default:

- `sauceapproved.com`

Shopify DNS target:

- A `@` → `23.227.38.65`
- AAAA `@` → `2620:0127:f00f:5::`
- CNAME `www` → `shops.myshopify.com`

TTL is set to 3600 seconds, which is within Spaceship's supported range. The DNS value `shops.myshopify.com` is equivalent to the fully-qualified `shops.myshopify.com.` form documented by Shopify.

## Safety

The adapter:

- accepts API credentials only at runtime;
- never commits or returns the API secret;
- allowlists domains before every request;
- limits reconciliation to the Shopify A, AAAA, and `www` CNAME targets;
- preserves unrelated MX, TXT, DKIM, DMARC, and other records;
- refuses to replace provider-managed conflicting records;
- does not delete custom conflicts unless `replaceCustomConflicts:true` is explicitly supplied;
- re-reads the DNS zone after a write and fails if verification does not match the Shopify target.

## Runtime credentials

Required environment variables:

- `HERCULES_SPACESHIP_API_KEY`
- `HERCULES_SPACESHIP_API_SECRET`

Optional:

- `HERCULES_SPACESHIP_ALLOWED_DOMAINS` — comma-separated; defaults to `sauceapproved.com`

The Spaceship API key should be least-privilege with only:

- `dnsrecords:read`
- `dnsrecords:write`

Do not use domain billing, transfer, or contact permissions for this adapter.

## Status

Source and tests can be merged before credentials exist. Live DNS mutation remains blocked until the owner authorizes Spaceship API access and the credentials are provisioned into a server-side secret store/runtime environment.

After DNS is verified, Shopify still requires the existing domain to be added from Shopify's Domains control surface before it can become the primary storefront domain.
