# Studio hosted activation

The Shopify Studio activation page currently links to a Supabase Edge Function HTML response. Live HTTP inspection on 2026-10-13 found that destination returns `text/plain`, preventing reliable interactive activation in a browser.

The Studio server now provides `/activate`, rendering only the fixed Hercules Studio access page with HTML response headers. POST accepts only email-link requests and authenticated Studio purchase claims. The relay rejects foreign/missing origins, unsupported actions, arbitrary upstream targets, redirects, oversized input/output, and invalid upstream responses. It forwards no cookies or service-role credentials. Paid entitlement and identity checks remain in Hercules.

The successful claim and activation-page fallback both hand off to the existing hosted Studio root, not the historical raw Supabase preview response (also served as text/plain). This changes the navigation destination, not authentication, membership, or execution permissions. The public Studio shell is not proof of paid-buyer sign-in or access to protected execution. Those require separate end-to-end evidence.

## Rollout checklist

1. Deploy the reviewed source commit to the existing SauceApproved Studio service and verify `/activate` returns the form with `text/html`, no-store, CSP, and framing protection.
2. Ensure Supabase Auth's allowed redirect URLs contain exactly `https://sauceapproved-studio.onrender.com/activate`. Do not broaden the redirect allowlist.
3. Deploy the reviewed `hercules-launch` change so Studio email links return to that hosted route.
4. Update only the Shopify Studio activation page's button destination to the verified hosted route. Preserve merchandise checkout, product states, prices, and Titan restrictions.
5. Verify the actual browser callback and matching-buyer claim after an authorized eligible purchase. Local tests do not establish email delivery, provider transport, or payment/refund evidence.

No production configuration is changed merely by this commit. Keep the existing destination until hosted route and Auth callback configuration are verified together.
