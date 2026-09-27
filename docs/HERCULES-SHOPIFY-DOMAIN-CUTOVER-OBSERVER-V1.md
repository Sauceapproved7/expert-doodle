# Hercules Shopify Domain Cutover Observer v1

Date: 2026-09-27 UTC

## Purpose

Carry the SauceApproved custom-domain launch from verified registrar DNS into Shopify without confusing Shopify aliases, SSL readiness, or primary-domain state.

The observer is deliberately separate from registrar DNS control. It accepts only a sanitized Shopify Admin domain snapshot from a trusted service-role operator.

## Production identity

The observer is locked to:

- Shop GID: `gid://shopify/Shop/100002726208`
- intended custom domain: `sauceapproved.com`

It rejects observations for any other shop.

## Stages

- `waiting_dns`
- `awaiting_attachment`
- `awaiting_ssl`
- `ready_for_primary`
- `complete`
- `blocked`

A custom domain cannot advance to `ready_for_primary` until Shopify reports that exact domain with SSL enabled.

The launch becomes `complete` only when Shopify reports `sauceapproved.com` as the primary domain and SSL is enabled both on the primary-domain record and the matching domain entry.

## Credential boundary

No Shopify access token is stored in this table, migration, observation payload, or status function.

The current ChatGPT Shopify connector can provide a verified domain snapshot. Future first-party Shopify authentication can feed the same observer without changing the state contract.

## Browser fallback

Hercules Browser remains the preferred browser path, but the current Shopify Domains admin page presents a connection-verification challenge to the server-side browser session. The observer does not bypass that challenge.

When DNS reaches `shopify_attach_pending`, an authorized Shopify surface may attach the custom domain. The observer then verifies attachment, SSL, and final primary-domain completion.
