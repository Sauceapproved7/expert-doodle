# SauceApproved Shopify Store Identity Resolution — 2026-09-27

## Result

The apparent Shopify-domain mismatch is resolved.

The connected production shop is one Shopify shop:

- Shop GID: `gid://shopify/Shop/100002726208`
- original myshopify domain: `azymhc-x0.myshopify.com`
- current primary domain: `sauceapproved-2.myshopify.com`
- current primary-domain SSL: enabled

These are not two different stores.

## Production anchor

The same shop contains the expected SauceApproved production hoodie:

- product: `SauceApproved™ Premium Graphic Hoodie | Unisex Streetwear`
- product GID: `gid://shopify/Product/10258238406976`
- status: ACTIVE
- vendor: Printify
- variants: 29

## Canonical rule

Production automation must identify the store by Shop GID first. The original myshopify domain and current primary myshopify domain are aliases/history for that same shop and must not be treated as separate production targets.

The intended public custom domain remains `sauceapproved.com`.

Primary-domain cutover remains gated on:

1. Spaceship DNS reconciliation;
2. Shopify recognition of the custom domain;
3. custom-domain SSL enabled;
4. final health verification.
