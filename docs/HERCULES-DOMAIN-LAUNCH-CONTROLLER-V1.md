# Hercules Domain Launch Controller v1

Date: 2026-09-27 UTC

## Purpose

Turn the existing SauceApproved domain inventory and Spaceship DNS control plane into one operator-ready launch controller for `sauceapproved.com`.

## Current observed state

Public DNS observed on 2026-09-27:

- apex A: `34.216.117.25`, `54.149.79.189`
- apex AAAA: none
- `www` CNAME: none
- nameservers: `launch1.spaceship.net`, `launch2.spaceship.net`

Those records do not yet match the Shopify target.

Desired Shopify web-routing records remain:

- A `@` → `23.227.38.65`
- AAAA `@` → `2620:0127:f00f:5::`
- CNAME `www` → `shops.myshopify.com`

## Controller actions

### production_status

Read-only. Returns:

- registered production-domain record;
- Spaceship credential configuration state without exposing secret references;
- live A, AAAA, CNAME, and NS answers;
- HTTPS reachability/redirect status;
- exact readiness flags and blockers.

### production_reconcile

Owner/admin only. Requires explicit `confirm_domain: "sauceapproved.com"`.

Before any write, it requires:

- the registered production domain to target a Shopify store;
- Spaceship DNS credentials to be configured;
- DNS not to already be exact.

It then queues the existing fail-closed Spaceship reconciliation. That underlying adapter preserves unrelated records and refuses provider-managed or unknown conflicting records.

### production_reconcile_result

Owner/admin only. Retrieves the result of a queued provider reconciliation.

## Shopify boundary

This controller prepares and verifies registrar DNS. Shopify custom-domain attachment and final primary-domain promotion remain separate stages because Shopify must recognize the custom domain and provision SSL before primary-domain cutover.
