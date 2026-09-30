# Hercules Shopify Domain Monitor v1

Date: 2026-09-27 UTC

## Purpose

Give the SauceApproved domain launch a first-party Shopify observation path that no longer depends on a ChatGPT session after a Hercules Shopify provider connection is authorized.

## Route

`pg_cron -> service-role submitter -> hercules-provider-connect -> Shopify Admin GraphQL -> hercules_shopify_domain_observe`

The monitor runs every five minutes, but it makes no provider request until both conditions are true:

1. the first-party Shopify provider connection is active with a Vault-backed access token reference;
2. the domain launch has reached `shopify_attach_pending`.

It also stops once the cutover state is `complete`.

## Production lock

The provider connector is pinned to:

- Shop GID: `gid://shopify/Shop/100002726208`
- canonical provider account key: `sauceapproved-2.myshopify.com`
- historical original myshopify alias: `azymhc-x0.myshopify.com`

An accidentally authorized second shop cannot advance the SauceApproved launch.

## Observed fields

Only sanitized domain metadata enters the cutover observer:

- domain ID;
- host;
- SSL enabled flag;
- current primary-domain ID, host, and SSL state.

Shopify access tokens and client secrets remain in Vault.

## Token recovery

If the stored Shopify access token returns HTTP 401 and the first-party provider connection has its client ID plus Vault-backed client-secret reference, Hercules performs the client-credentials exchange again, stores the refreshed access token in Vault, and updates the provider connection.

## Authentication

The Edge Function uses custom authentication because scheduled internal calls cannot carry a Supabase user JWT:

- internal monitor calls require a random Vault-backed internal key verified by SHA-256;
- owner-facing provider configuration/status actions still require an authenticated Supabase owner/admin membership.

## Shopify mutation boundary

The connected Admin GraphQL schema exposes domain reads and web-presence mutations, but does not expose a public mutation that creates a custom Domain resource or directly changes the shop primary domain. Hercules therefore monitors attachment, SSL, and primary status rather than fabricating an unsupported private API.

The server-side Hercules Browser was also tested against Shopify Domains and encountered the provider's connection-verification challenge. That protection is not bypassed.


## Secure owner onboarding

Hercules Integrations now includes a `Shopify Direct` card. It accepts the Shopify Client ID and Client Secret over the authenticated Hercules surface, sends them directly to `hercules-provider-connect`, clears both input fields after submission, and stores the client secret plus exchanged access token in Vault.

A successful connection immediately verifies the fixed production Shop GID, registers the existing Hercules Shopify webhooks when missing, and records a sanitized domain observation.

The UI does not display or return stored Shopify credentials.
