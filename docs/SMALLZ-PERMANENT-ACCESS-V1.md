# Smallz permanent access

The /launch route on the existing Smallz Render service provides permanent links to the current Shopify hoodie page, Smallz owner console, and Studio. It does not depend on custom-domain DNS or expiring handoff tokens, and it does not contain credential fields or scripts. Authentication and payment/launch gates remain in their existing services.

Differentiators: durable access independent of registrar authorization and expiring credential links; commerce and owner-tool destinations remain distinct without claiming a complete paid launch.

October 12 observations: Shopify confirms sauceapproved-2.myshopify.com is primary with SSL enabled, checkoutApiSupported=true and setupRequired=false. The premium hoodie is ACTIVE; public product JSON marks variants available, and the owned browser sees Add to cart and Buy it now. Studio /health returns HTTP 200 with ok=true. Shopify payment-account readback is denied by the connection's missing payments read scope, so payout/payment configuration and real payment settlement are not verified by this work.

No DNS records, Shopify prices/publication states, launch approvals, checkout configuration, or real-money transactions are modified. No guarantee of settlement or certified Studio rendering is made.

Owned-browser request 100900 reached the real Shopify checkout contact/delivery stage with the S / Black hoodie in the order summary at $35.97. No contact details, shipping address, payment instrument, order submission, charge, or refund was supplied. Checkout reachability is verified; completed payment and settlement remain unverified.
