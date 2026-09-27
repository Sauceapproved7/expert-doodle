# Hercules Production Domain Status + Shopify Launch Readiness v1

Date: 2026-09-27 UTC

## Purpose

Make the production-domain status surface answer the whole launch question from one authenticated Hercules endpoint.

The response now combines:

- the registered `sauceapproved.com` domain record;
- Spaceship credential configuration state;
- live public A, AAAA, CNAME, NS, and HTTPS checks;
- domain-launch readiness;
- sanitized Shopify custom-domain cutover state;
- sanitized Shopify storefront launch-readiness gates.

## Shopify cutover fields

The domain status may return:

- cutover stage;
- current primary host/domain ID/SSL state;
- whether `sauceapproved.com` is present;
- intended custom-domain ID and SSL state;
- last observation time/source;
- bounded last error.

## Launch-readiness fields

The status may return:

- readiness stage;
- gate booleans;
- observation source;
- last error;
- observed/transition/update timestamps.

The full Shopify readiness snapshot is deliberately not returned from this domain endpoint. Product/discount/fulfillment audit details remain stored in the dedicated readiness state rather than making the domain status unnecessarily large.

## Security

No Shopify access token, client secret, Vault reference, registrar secret, or bank/payment data is selected or returned.
