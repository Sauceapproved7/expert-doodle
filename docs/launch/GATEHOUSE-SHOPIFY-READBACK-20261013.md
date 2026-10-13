# Hercules Gatehouse — Shopify read-only order observer (not activated)

## Verification on October 13, 2026

- The **connected ChatGPT Shopify Admin app** can independently read the SauceApproved shop and executed a schema-validated Admin GraphQL query for the most recent 10 orders. It returned **0 orders**.
- The owned Supabase project has exactly one `hercules_provider_connections` row for the canonical store, marked `active`. The row originated from connected-app/storefront confirmation but **does not have `client_id`, `secret_ref`, `access_secret_ref` or `signing_secret_ref`**. Thus the app-auth credential exchange implemented here CANNOT currently complete against that row.
- This distinction is intentional: connected ChatGPT app authorization cannot be silently exported into Gatehouse, and a database row labeled active is not proof that the independent Gatehouse runtime has Shopify credentials.
- The $49 Gatehouse diagnostic remains a **DRAFT** Shopify product. No purchaser was observed. Gatehouse buyer report delivery and monthly subscription billing remain disabled.

## Architecture

This feature branch supplies a **private, separate Supabase Edge Function** and a pure, testable order classification module. It is not deployed in this commit. The function uses verified Supabase owner/admin JWT plus active organization membership, reads the exact organization's provider connection, and would retrieve existing secret references server-side *if and only if* valid authorization is present. All output is restricted to recent bounded order candidate counts and non-PII product class information.

The validated GraphQL operation requests only order GID, paid/test/cancellation status, currency, total and refunded amount, line-item SKU/quantity/product ID/variant ID/line price and bounded pagination. It does not request customer email, addresses, or payment instruments. Refunded, cancelled, test, mixed-cart and wrong-product orders are rejected.

**No published paid order or claim can be created by this function.** Its output can never authorize report delivery or payouts. The current Gatehouse public dashboard does not expose the private owner data.

## Activation boundary

Do not deploy this function or assert that a live independent order reader is connected until:

1. The existing business' Shopify app authorization is legitimately made available to the owned provider credential vault via an approved route (do not copy keys into code/chat, reauthorize unnecessarily, or alter the existing Studio/Titan connection in place).
2. Owner JWT checks and exact organization-to-shop ownership are demonstrated.
3. The authenticated function produces a successful read-only Shopify API result; a zero-order result is valid and must not be confused with missing provider authorization.
4. Review the function's rate limits, coverage, internal error handling, and denial behavior before use. Keep `verify_jwt=true`; no public CORS or anonymous private revenue exposure.
5. Until separately proven, the commercial offer remains draft, `deliveryAuthorized=false`, and actual payout/buyer delivery remain unverified.

No new cloud project, bank connection, checkout, product publication, token, charge, refund, webhook, migration, or entitlement mutation is authorized by this branch.
