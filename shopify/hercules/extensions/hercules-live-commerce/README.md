# Hercules Live Commerce theme block

This theme app extension adds a merchant-configurable live event card to an Online Store 2.0 theme.

## Merchant setup

1. Add the **Live event** app block to a section in the theme editor.
2. Set the event title, customer-facing time, and state.
3. Add an HTTPS stream URL. The watch link appears only when the merchant sets the event state to **Live now**.
4. Optionally select a Shopify product. The card shows its current image and price and links buyers to its Shopify variant page.

The product, cart, checkout, inventory, and order remain Shopify-owned. The block does not reserve stock or claim to detect stream health. The event state is an explicit merchant setting, so it must be changed in the theme editor when the stream starts or ends.

The extension makes no Admin API calls, stores no credentials, adds no app scopes, and does not add code to checkout. It links to a merchant-provided HTTPS destination and the selected product's Shopify page.

## Validation

Run the repository's Node test directly:

```sh
node --test tests/hercules-shopify-live-commerce-theme.test.mjs
```

Before installing on a store, validate the app with Shopify CLI and preview the block in a development theme. Publishing the extension requires deploying the existing Hercules app and a merchant enabling the block in their theme.
