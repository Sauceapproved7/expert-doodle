# Hercules Shopify Launch Readiness v1

Date: 2026-09-27 UTC

## Purpose

Track whether the production SauceApproved Shopify storefront is actually launch-ready rather than treating domain work as the only release gate.

## Required storefront gates

The readiness evaluator is locked to the verified production shop and anchor hoodie.

It requires:

- production Shop GID matches `gid://shopify/Shop/100002726208`;
- the shop is not a partner-development store and has a named paid plan;
- one MAIN theme is present and is neither processing nor failed;
- anchor hoodie `gid://shopify/Product/10258238406976` is ACTIVE, vendor Printify, has at least 29 variants, at least 16 media items, and an online-store URL;
- the anchor hoodie is published to Online Store and Shop;
- Launch Drop, Hoodies, and Apparel collections each contain products and are published;
- the default main menu includes Home, Shop, Apps, and Contact;
- the default footer includes Privacy Policy and Contact.

Google & YouTube publication is tracked but is not required for the storefront-ready gate.

Printify tracked inventory is deliberately not a hard gate because print-on-demand products can be sellable without a positive Shopify tracked-inventory count.

## Stages

- `blocked_storefront`: one or more required storefront gates failed.
- `ready_except_domain`: storefront/product/channel/navigation gates are green, but `sauceapproved.com` is not yet SSL-enabled and primary.
- `ready`: storefront gates are green and the custom-domain cutover is complete.
- `unknown`: no verified snapshot has been ingested yet.

## Refresh path

A first-party Shopify readiness monitor runs every fifteen minutes after the Hercules Shopify provider connection is authorized. Until that connection exists, the monitor returns without making a provider request.

The current ChatGPT Shopify connector can seed a sanitized snapshot so the readiness state is useful before the first-party credential is authorized.
