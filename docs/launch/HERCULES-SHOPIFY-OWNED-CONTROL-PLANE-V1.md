# Hercules Shopify Owned Control Plane v1

Hercules owns the post-checkout control plane. Shopify remains the storefront, checkout, and authenticated event source.

## Existing production receiver

The canonical receiver is `supabase/functions/hercules-shopify-webhook/index.ts`. It retains native Shopify HMAC verification, canonical shop validation, unique delivery handling, exact Studio/Titan allowlists, and reconciliation through `hercules_reconcile_verified_shopify_paid_order_v1`.

## App control-plane target

Only the existing installed Hercules Shopify app may be linked. Do not create a replacement app to avoid an owner authorization boundary. After the existing app is linked to a Shopify CLI project, commit the generated app configuration and Hercules Flow action extension to this repository. Routine extension changes then flow through code review, tests, and deployment.

## Security boundaries

- Never commit Shopify client secrets, access tokens, bridge tokens, signing secrets, or customer email addresses.
- Never weaken HMAC verification to make deployment easier.
- Never fabricate paid orders or settlement evidence.
- Never enable commerce merely because event transport is connected.
- Provider-specific code stays replaceable; Hercules-owned contracts remain authoritative.

## One-time authorization boundary

Linking the existing Dashboard-managed Hercules app to its code project requires Shopify authorization. Repository code does not reproduce or bypass that authorization. After linking, routine changes should be automated through the owned deployment path.
