# Hercules Shopify Paid-Order Reconciliation v1

## Purpose

This is a temporary continuity fallback for legitimate SauceApproved Studio and Hercules Titan Shopify buyers while native Shopify `ORDERS_PAID` webhook registration is unavailable.

It does **not** open checkout, approve pricing or legal terms, publish a product, or alter the payment provider.

## Authority

Order facts must come from the authenticated connected Shopify Admin API. Customer-supplied receipts, screenshots, order numbers, or payment claims are not sufficient.

Canonical policy: `governance/hercules-shopify-paid-order-reconciliation-v1.json`.

## Exact eligible products

- SauceApproved Studio
  - product: `15397259477312`
  - variant: `67601341153600`
  - SKU: `SA-STUDIO-PILOT-001`
- Hercules Titan Founding Access
  - product: `10261114782016`
  - variant: `53144447811904`
  - SKU: `HERCULES-TITAN-FOUNDING`

Anything else is ignored.

## Runner procedure

When the native paid-order webhook is absent and the connected Shopify Admin API is available:

1. Read recent Shopify orders within the bounded lookback window.
2. Require Shopify to report the order as paid.
3. Reject test or cancelled orders.
4. Ignore all non-allowlisted line items.
5. Normalize the Shopify checkout email and compute its SHA-256 locally. Do not persist raw email in Hercules.
6. Invoke `public.hercules_reconcile_verified_shopify_paid_order_v1` with only the verified order/line facts.
7. The RPC idempotently creates or reuses the entitlement.
8. The RPC calls the existing SoundWorld eligibility function, which independently enforces the public-paid-launch timestamp and 14-day window.
9. Record evidence; do not modify checkout or publication state.

## Safety

- No customer-supplied payment claims.
- No raw buyer-email storage.
- No unrelated orders.
- No legal/commercial approval changes.
- No price changes.
- No checkout/publication changes.
- No bypass of Shopify human verification or webhook safety controls.
- Reprocessing is safe because the entitlement identity is idempotent.

## Retirement

Disable this fallback only after a native Shopify `ORDERS_PAID` subscription is registered to the owned Hercules entitlement receiver and a real end-to-end paid-order entitlement flow is verified.
