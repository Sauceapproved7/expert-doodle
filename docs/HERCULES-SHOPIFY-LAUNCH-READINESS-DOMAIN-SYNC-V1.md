# Hercules Shopify Launch Readiness Domain Sync v1

Date: 2026-09-27 UTC

The launch-readiness state now reacts immediately to verified custom-domain cutover changes.

Before this increment, `ready_except_domain` became `ready` on the next full Shopify readiness snapshot. That was safe but could leave the launch state stale when first-party Shopify provider credentials were not yet connected.

A database trigger now listens only to the sanitized `hercules_shopify_domain_cutover` state. It marks the readiness `domainComplete` gate true only when:

- cutover stage is `complete`;
- `sauceapproved.com` is present in Shopify;
- SSL is enabled for the intended domain;
- `sauceapproved.com` is the current primary host.

If all storefront gates were already green, the launch readiness moves directly from `ready_except_domain` to `ready`.

No Shopify credentials or registrar secrets are involved in this synchronization.
