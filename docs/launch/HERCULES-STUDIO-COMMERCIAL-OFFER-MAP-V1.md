# SauceApproved Studio Commercial Offer Map v1

## Two distinct offers

### 1. Shopify Founding Pilot — one-time early access

- Price: **$99 one time**
- Shopify product: `gid://shopify/Product/15397259477312`
- Variant: `gid://shopify/ProductVariant/67601341153600`
- SKU: `SA-STUDIO-PILOT-001`
- Current product status: **DRAFT**
- Billing model: one-time purchase
- Purpose: bounded Founding Pilot / early-access entitlement
- SoundWorld launch gift: governed separately by `hercules-soundworld-launch-gift-v1`

This offer is not equivalent to a monthly Studio subscription.

### 2. Studio monthly subscription catalog

Product-scoped owner-approval candidate:

- Starter — **$29/month**
- Pro — **$79/month**
- Business — **$199/month** (internal plan code `agency`)

These monthly plans remain checkout-disabled until all product-scoped gates are approved:

1. pricing
2. Terms
3. Privacy
4. payment provider ready
5. payment path verified

## Hard separation rules

- A $99 Founding Pilot purchase must not silently convert to a monthly subscription.
- Approval of the monthly catalog must not automatically publish the $99 Shopify Founding Pilot.
- The $99 Shopify listing must not be treated as approval of the $29/$79/$199 monthly catalog.
- The monthly checkout activation function remains service-role-only and fail-closed.
- Public publication of either commercial surface remains an explicit launch decision after its own gates are satisfied.
