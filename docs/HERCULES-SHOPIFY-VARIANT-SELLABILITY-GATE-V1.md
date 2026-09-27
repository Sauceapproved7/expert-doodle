# Hercules Shopify Variant Sellability Gate v1

Date: 2026-09-27 UTC

## Purpose

Strengthen SauceApproved launch readiness so variant count alone cannot mark the hoodie ready when one or more variants are unavailable for sale.

## Verified production state

Live Shopify Admin data on 2026-09-27 reports all 29 SauceApproved Premium Hoodie variants as:

- `availableForSale = true`;
- `inventoryPolicy = CONTINUE`;
- tracked inventory quantity = 0.

The zero quantity is expected for this Printify print-on-demand configuration. The important launch condition is that Shopify continues selling the variants instead of treating zero inventory as sold out.

## New gate

`variantSellability` is true only when:

- the production hoodie has at least 29 variants;
- the number of `availableForSale=true` variants equals the total variant count;
- the number of `inventoryPolicy=CONTINUE` variants equals the total variant count.

`storefrontReady` now requires this gate.

## First-party monitor

The existing Hercules Shopify launch-readiness query now retrieves each variant's `availableForSale` and `inventoryPolicy` fields and stores only aggregate counts in the sanitized readiness snapshot.

No Shopify credential values are added to readiness state.
