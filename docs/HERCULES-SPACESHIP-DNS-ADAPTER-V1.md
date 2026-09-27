# Hercules Spaceship DNS Adapter v1

Date: 2026-09-27 UTC

## Purpose

Connect SauceApproved-owned domains at Spaceship to Shopify through a narrow, auditable DNS adapter instead of depending on browser automation when the registrar rejects automated sessions.

The first target is `sauceapproved.com`.

## Browser-first routing

Hercules Browser remains the default browser path. A live Hercules Browser attempt reached Spaceship but Spaceship's Cloudflare verification challenge blocked the automated session. Hercules does not bypass that protection.

When an authorized Spaceship API credential is available, the DNS adapter is the supported fallback because it uses Spaceship's documented account API rather than defeating site security.

## Shopify DNS contract

The adapter manages only these web-routing records:

| Type | Name | Value | TTL |
| --- | --- | --- | ---: |
| A | @ | 23.227.38.65 | 3600 |
| AAAA | @ | 2620:0127:f00f:5:: | 3600 |
| CNAME | www | shops.myshopify.com | 3600 |

It does not modify MX, TXT, SRV, DKIM, DMARC, email, verification, or unrelated subdomain records. Record payloads follow Spaceship's type-specific API contract: A/AAAA use `address`; CNAME uses `cname`.

## Spaceship API boundary

The adapter uses Spaceship's documented External API:

- read DNS records: `GET /api/v1/dns/records/{domain}`
- save DNS records: `PUT /api/v1/dns/records/{domain}`
- delete conflicting custom records: `DELETE /api/v1/dns/records/{domain}`

Required API permissions:

- `dnsrecords:read`
- `dnsrecords:write`

Credentials are supplied only through:

- `HERCULES_SPACESHIP_API_KEY`
- `HERCULES_SPACESHIP_API_SECRET`

Never commit either value to the repository, logs, reports, or browser-visible client code.

## Reconciliation behavior

`planShopifyDnsReconciliation()` is intentionally narrow.

It may replace only:

- apex A records;
- apex AAAA records;
- the `www` CNAME.

All unrelated records are preserved.

`SpaceshipDnsClient.reconcileShopify()`:

1. reads the current DNS zone;
2. calculates a minimal reconciliation;
3. refuses provider-managed, personal-nameserver, or unknown-ownership conflicts;
4. requires explicit `replaceCustomConflicts:true` before deleting conflicting custom A/AAAA/www records;
5. saves only missing Shopify records with Spaceship's documented 60–3600 second TTL range;
6. reads the complete paginated zone again;
7. fails unless the resulting Shopify DNS contract verifies exactly.

The operation is idempotent after the required records are in place.

## Launch sequence for sauceapproved.com

1. Obtain an authorized Spaceship API key/secret with DNS read/write only.
2. Keep the credentials in server-side secret storage.
3. Run the adapter for `sauceapproved.com`.
4. Verify the final DNS zone.
5. Add/verify `sauceapproved.com` in Shopify admin.
6. Wait for Shopify SSL/domain verification.
7. Make the custom domain primary only after verification passes.

No purchase, renewal, transfer, nameserver change, or billing action is part of this adapter.


## Safety hardening

The DNS client is domain-allowlisted. The default allowlist contains only `sauceapproved.com`; additional domains must be explicitly injected through `HERCULES_SPACESHIP_ALLOWED_DOMAINS`.

Spaceship marks DNS records with ownership metadata. Only records whose group is `custom` are eligible for replacement. A conflict owned by a Spaceship product, personal nameserver configuration, or an unknown group fails closed instead of being deleted.

The client paginates the full DNS inventory before planning changes so a conflict cannot be missed merely because the zone contains more than one API page.
