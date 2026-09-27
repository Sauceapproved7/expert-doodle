# Hercules Shopify Storefront Verification Evidence v1

Date: 2026-09-27 UTC

## Purpose

Persist live public-storefront proof inside the canonical Shopify launch-readiness state instead of leaving a successful Hercules Browser verification only in transient run history.

## Evidence

The service-role-only recorder stores a sanitized result from an owned Browser Agent run:

- Browser Agent run ID;
- page title;
- product visible;
- size/color variants visible;
- Add to cart or purchase control visible;
- source;
- observation timestamp.

No browser secret, cookie, internal key, user credential, or reusable session identifier is stored.

## Verification rule

The storefront becomes `verified` only when all three commerce observations are true:

1. the SauceApproved product is visible;
2. variant controls are visible;
3. Add to cart or a purchase control is visible.

Otherwise the latest evidence is stored as `failed` without erasing an earlier successful verification timestamp.

## Production status

Hercules Domains production status now includes:

- `storefront_status`;
- `storefront_verified_at`;
- `storefront_verification`.

This keeps public storefront proof alongside Shopify cutover and launch-readiness state.

## Initial production evidence

The first production record is intended to come from the verified Browser Agent run that loaded the SauceApproved premium hoodie page and observed the product, size/color options, Add to cart, and Buy it now without changing state.
