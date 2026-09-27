# Hercules Browser Session Recovery v1

Date: 2026-09-27 UTC

## Problem

A live SauceApproved storefront verification exposed a transient browser-worker failure after the initial navigation succeeded:

`locator.count: Target page, context or browser has been closed`

The first navigation had already reached the correct Shopify product page, so treating every later page-close as a permanent run failure wastes a valid browser attempt.

## Recovery rule

Hercules Browser Agent v0.6 adds one bounded fresh-session recovery when the worker reports the specific closed-page/context/browser condition.

Recovery is allowed only when the run is replay-safe:

- no prior click action;
- no prior type action;
- at most one recovery per agent run.

For a scrape failure, Hercules re-navigates to the current allowed page URL and retries the scrape.

For an interaction failure, recovery is permitted only for `extract` or `wait` actions. Click and type are never replayed automatically because doing so could duplicate stateful behavior.

## Guardrails

The recovered URL must still pass the existing allowed-domain check.

The change does not weaken:

- CAPTCHA or anti-bot restrictions;
- private-network restrictions;
- raw code execution restrictions;
- high-impact action restrictions;
- the six-step Browser Agent bound.

If the single safe recovery fails, the run fails normally instead of looping.
