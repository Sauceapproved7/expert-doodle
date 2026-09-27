# Hercules Browser Deterministic Observation Evaluator v1

Date: 2026-09-27 UTC

## Purpose

Finish common read-only storefront verification directly from trusted navigation evidence without requiring a second browser scrape or an AI planner round-trip.

A live SauceApproved product-page verification showed that the initial owned-browser navigation already returned the information needed to answer whether the page loaded, what its title was, whether the hoodie was visible, whether variant choices appeared, and whether purchase controls were present.

## Behavior

Browser Agent v0.9 evaluates a narrow set of composite observational questions directly from the initial navigation title and text.

Supported evidence categories include:

- public reachability;
- page title;
- SauceApproved hoodie/product visibility;
- size/color option visibility;
- Add to cart / Buy it now visibility.

The deterministic path requires at least two requested observation categories. This keeps it from becoming a general-purpose semantic shortcut.

## Safety

The path is disabled whenever named input values are supplied.

It performs no click, type, extract, submit, login, purchase, or other state-changing browser action.

If the deterministic evaluator cannot confidently cover the requested observation, Browser Agent continues into the existing read-only planner and bounded browser loop.

Existing protections remain unchanged:

- allowed-domain enforcement;
- anti-bot/CAPTCHA bypass prohibition;
- high-impact autonomy prohibition;
- raw browser code execution prohibition;
- replay-safe session recovery bounds.
