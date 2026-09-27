# Hercules Browser Navigate-First Observation v1

Date: 2026-09-27 UTC

## Problem

The owned browser reliably reaches the public SauceApproved Shopify product page and returns its title, body text, and links from the initial navigation request. The separate persistent-session scrape can fail when the remote browser page/context closes between requests.

A live storefront probe confirmed the initial navigation already contained enough evidence to answer read-only questions such as whether the hoodie, size/color options, Add to cart, and Buy it now controls are visible.

## Change

Browser Agent v0.7 evaluates safe read-only goals directly from the initial navigation evidence before issuing a second browser request.

Examples of eligible intents include:

- verify;
- check;
- determine;
- inspect;
- report whether something is visible or reachable;
- describe or read information already present on the page.

The planner may only end this fast path with `finish`. Any click, type, extract, or wait plan falls back to the normal bounded browser loop.

## Safety

The navigate-first path is disabled whenever named input values are supplied.

It also distinguishes read-only requests from stateful imperatives. Explicit instructions such as click, submit, buy, sign in, create, delete, update, save, connect, or configure do not use the observation shortcut unless the goal explicitly states a read-only prohibition such as “do not change state.”

No state-changing browser action is executed from this fast path.

Existing protections remain:

- allowed-domain enforcement;
- CAPTCHA and anti-bot bypass prohibition;
- high-impact autonomy prohibition;
- raw browser code execution prohibition;
- bounded step count;
- one safe transient-session recovery for replay-safe flows.
