# Hercules Integrations Launch Summary v1

Date: 2026-09-27 UTC

## Purpose

Replace the raw-only SauceApproved launch-readiness display with a concise operator summary while preserving the underlying JSON for diagnostics.

## Summary states

The Integrations page now shows:

- Overall: READY, READY EXCEPT DOMAIN, or BLOCKED.
- Live storefront: verified/unverified.
- Storefront gates: pass/fail.
- Custom domain: current cutover stage.
- Spaceship DNS: authorized or authorization needed.
- Next action: the actual next launch step.
- Storefront verification timestamp when available.

## Decision rule

`READY` requires:

1. storefront readiness gates passing;
2. a verified live storefront observation;
3. the custom-domain gate complete.

When the first two are true but the custom domain is incomplete, the page reports `READY EXCEPT DOMAIN`.

## Owner boundary

When Spaceship DNS credentials are still unconfigured, the summary identifies the remaining owner action as authorizing a least-privilege Spaceship API credential with only:

- `dnsrecords:read`
- `dnsrecords:write`

After that authorization exists, the summary naturally advances to automatic DNS reconciliation/propagation and then Shopify custom-domain/SSL cutover.

No registrar or Shopify secret values are rendered by the summary.
