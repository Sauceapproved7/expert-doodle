# Hercules Storefront Smoke → Launch Readiness Sync v1

Date: 2026-09-27 UTC

## Purpose

Make the production launch summary reflect the latest live storefront smoke result automatically instead of leaving a one-time browser verification marked as good indefinitely.

## Behavior

Completed Browser Agent runs tagged `hercules-storefront-smoke` are synchronized into the existing launch-readiness fields.

A smoke run is `verified` only when:

- Browser Agent status is `succeeded`;
- the page is publicly reachable;
- the SauceApproved hoodie is visible;
- size/color variant controls are visible;
- Add to cart or another purchase control is visible.

A failed, blocked, or incomplete completed smoke changes the storefront status to `failed` and clears the previous verified timestamp.

## Evidence

The readiness row stores only sanitized browser evidence:

- run ID;
- observed time;
- target URL;
- page title;
- convergence mode;
- boolean observations;
- browser status and error.

The same sanitized evidence is mirrored into the existing `snapshot.storefrontVerification` object without replacing product, shipping, fulfillment, discount, checkout, tax, or other launch audits.

## Trigger path

The synchronization fires on both insert and terminal-status updates to `hercules_browser_agent_runs`, but immediately ignores every run not tagged `hercules-storefront-smoke`.

No credential or provider secret path is introduced.
