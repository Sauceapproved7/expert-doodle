# Hercules Storefront Smoke Sentinel v1

Date: 2026-09-27 UTC

## Purpose

Continuously verify that the live SauceApproved hoodie storefront remains usable while the custom-domain launch is still waiting on registrar authorization.

## What it checks

The smoke test uses the owned Hercules Browser Agent in read-only mode and verifies:

- the production product page is publicly reachable;
- the page title is present;
- the SauceApproved hoodie is visible;
- size/color variant controls are visible;
- Add to cart or another purchase control is visible.

It never adds to cart and never changes state.

## Target selection

Before the custom-domain cutover is complete, the sentinel uses the verified Shopify product URL from the launch-readiness snapshot.

After `sauceapproved.com` is present in Shopify, SSL-enabled, and primary, the sentinel automatically switches to:

`https://sauceapproved.com/products/sauceapproved-premium-hoodie`

## Cadence and overlap control

The check runs hourly at minute 17.

If a previous smoke run is still running and is less than ten minutes old, the next submission is skipped instead of creating overlapping browser work.

## Health semantics

The latest smoke state is healthy only when:

- Browser Agent status is `succeeded`;
- the result is no older than two hours;
- all required storefront observations are affirmative.

The existing Browser Agent run log remains the durable evidence source; no duplicate credential-bearing state is created.
