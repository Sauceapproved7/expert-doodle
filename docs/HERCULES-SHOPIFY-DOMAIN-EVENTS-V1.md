# Hercules Shopify Domain Events Fast Path v1

Date: 2026-09-27 UTC

## Purpose

Reduce the delay between a Shopify domain change and Hercules observing the new attachment, SSL, or primary-domain state.

The existing five-minute Shopify domain monitor remains the backstop. This increment adds verified Shopify domain lifecycle webhooks as a fast path.

## Registered topics

When the first-party Shopify provider connection is configured, Hercules now ensures subscriptions for:

- `DOMAINS_CREATE`
- `DOMAINS_UPDATE`
- `DOMAINS_DESTROY`

alongside the existing order, product, and refund topics.

## Webhook path

The existing `hercules-shopify-webhook` continues to enforce native Shopify HMAC verification, fixed production-shop validation, webhook-ID presence, receipt deduplication, and persistence before any domain-monitor nudge occurs.

After a verified `domains/create`, `domains/update`, or `domains/destroy` event is persisted, the receiver calls the server-side `hercules_shopify_domain_monitor_submit()` function.

That submitter still fails closed:

- it makes no Shopify request until the first-party provider connection is active;
- it makes no Shopify request until registrar/DNS launch is at `shopify_attach_pending`;
- it stops after the cutover state is `complete`.

A failed monitor nudge does not reject an already valid Shopify webhook. The cron monitor remains the recovery path.

## Security

No new credential path is introduced. The webhook receiver continues to retrieve the Shopify signing secret from environment configuration or the active provider connection's Vault-backed secret reference.
