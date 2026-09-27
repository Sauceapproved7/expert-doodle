# Hercules Production Domain Status + Shopify Cutover v1

Date: 2026-09-27 UTC

The production-domain status surface now includes the sanitized Shopify cutover observer state alongside registrar credentials, live DNS, HTTPS reachability, and launch readiness.

Exposed Shopify fields are limited to:

- cutover stage;
- current primary host/domain ID/SSL state;
- whether `sauceapproved.com` is present;
- the custom-domain ID when present;
- custom-domain SSL state;
- observation timestamp/source;
- bounded last error.

No Shopify access token, client secret, Vault reference, or provider credential is returned.

This means Hercules Integrations can show the entire domain launch in one production status response without adding another owner-facing API surface.
