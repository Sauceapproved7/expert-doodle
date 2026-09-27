# Hercules Spaceship Secure Onboarding v1

Date: 2026-09-27 UTC

## Purpose

Provide the owner a secure browser handoff for the two Spaceship External API credential values without placing either value in a ChatGPT conversation, Git repository, audit log, or client-visible status response.

## Flow

1. The owner signs in to the existing Hercules Integrations surface.
2. The Spaceship DNS card accepts the API key and API secret over HTTPS.
3. The page sends them directly to `hercules-private-bridge` with the owner's Supabase session token.
4. The bridge re-validates the user and requires an active owner/admin membership.
5. The bridge invokes `hercules_spaceship_dns_configure_credentials`.
6. The database stores the values in Vault and keeps only Vault references in the credential registry.
7. The browser fields are cleared immediately after submission.
8. Status returns only configuration state and timestamps.

## Required Spaceship permissions

The API key should have exactly:

- `dnsrecords:read`
- `dnsrecords:write`

No domain transfer, billing, contact, nameserver, registration, or hosting permissions are required for the Shopify DNS reconciliation lane.

## Secret handling

The API secret is displayed once by Spaceship when the API key is created. It should be entered into the Hercules Integrations password field and not pasted into chat.

Once status is `configured`, the existing Hercules DNS operator route can inspect and reconcile `sauceapproved.com` while preserving unrelated DNS records and failing closed on unsafe conflicts.
