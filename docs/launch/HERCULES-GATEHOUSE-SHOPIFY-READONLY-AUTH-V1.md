# Hercules Gatehouse Shopify order-read authorization — v1

The existing `Hercules` Shopify app is installed on the SauceApproved store with client ID `1ed12710f0b797a7a3328c1cf4e8b1f9`, `read_orders` scope, and shop GID `gid://shopify/Shop/100002726208`. The live API shop domain was independently verified as `azymhc-x0.myshopify.com`. Shopify's [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens) and [Client credentials grant](https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant) documentation require the **matching Client Secret** plus Client ID. The client credentials grant only works if app and store belong to the same Shopify Dev Dashboard organization; other app distributions require an appropriate authorized OAuth flow.

## The narrow first-party pathway

The existing [Hercules Integrations](https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-integrations) owner page now has `Connect Shopify orders — read only`, `Read-only status`, and `Verify orders (read only)` controls, separate from legacy `Connect + arm monitors (optional)`.

1. Owner signs into Hercules. This is non-delegable sign-in and **never requests a secret in ChatGPT**.
2. The dedicated action `configure_gatehouse_shopify_readonly` verifies an exact client ID, owner role, Shopify-issued token response including `read_orders` and expiry, then live fixed original Shopify shop GID and a bounded order read. It stores app secret and token in private Supabase Vault, references in `public.gatehouse_shopify_readonly_connections` only.
3. The table has RLS, no anon/authenticated grants, fixed app/store constraints, and one organization-scoped record; ordinary customers cannot read token refs.
4. Owner action `gatehouse_shopify_readonly_observe` renews the token from the already-approved Vault Client Secret when expiring, and returns only bounded aggregate candidate counts. It never returns raw order IDs, PII, raw GraphQL data or credentials and never creates webhooks, draft orders, refunds, charges or customer entitlements.
5. Provider 401/error, mismatched shop, missing `read_orders`, expired/missing credentials, or scope mismatch fail closed. The UI catches errors and clears secret fields.

**No automatic monetization activation.** The new source does not authorize public Shopify checkout, Gatehouse product publication, buyer account creation, domain scanning or release of customer reports. A candidate is NOT a completed buyer-specific delivery test; financial settlement and refund verification remain separately gated. The Render Gatehouse service has no Vault access in this change and still holds `purchaseEnabled:false`, `deliveryAuthorized:false`.

The existing canonical `hercules_provider_connections` Shopify webhook/domain monitor record is **not edited or activated** by this pathway, preserving live hoodie/Titan/Studio operations and preventing accidental domain monitoring changes. The separate original full integration remains an explicit distinct owner decision.

## Source and provenance

Original SauceApproved/Hercules first-party code. No third-party source copied. Changes are confined to the existing owner UI, the authenticated provider Edge Function (new gated actions), private additive migration and test/docs files. Test suite validates client ID, shop lock, no webhook action, no payment/delivery authority, private SQL permissions and no implicit monitor activation.

## Provider limitation

If the legitimate Client Secret is not accessible and the current app/store are not in the same Shopify Dev Dashboard organization, this grant is unavailable. Do **not** synthesize or concatenate unrelated Supabase tokens. An owner-approved OAuth grant for the same app is the next supported authorization path. Approval, signatures, 2FA and Shopify identity actions remain owner-controlled.
