# Hercules Studio Post-Approval Launch Sequence v1

This sequence begins only after the authenticated owner approval for the Studio + Ads commercial packet is recorded.

## Owner approval boundary

Canonical packet:
- version: `software-commercial-v2`
- exact confirmation: `APPROVE SAUCEAPPROVED SOFTWARE COMMERCIAL PACKET CD8F2488748F`

That approval covers the product-scoped candidate pricing, Terms, and Privacy for SauceApproved Studio + SauceApproved Ads Engine. It does **not** approve payment-provider custody, payment-path verification, or public checkout by itself.

## Automated sequence after approval

1. Re-read `hercules_software_commercial_approvals`.
2. Require Studio `pricing`, `terms`, and `privacy` = `approved`.
3. Keep `checkout_enabled=false`.
4. Verify `payment_provider_ready` from current provider evidence only.
5. Prepare the isolated **Starter $29** controlled payment verification path.
6. Complete the provider-controlled checkout only with owner payment authorization where required.
7. Require signed/verified subscription/payment evidence.
8. Automatically cancel the verification subscription.
9. Require refund/reversal evidence.
10. Require payout-state evidence.
11. Record `payment_path_verified=approved` only after the complete evidence set exists.
12. Call `hercules_activate_software_checkout('sauceapproved-studio')` as service role.
13. Re-read readiness and require:
    - blockers = []
    - checkout_enabled = true
    - Starter / Pro / Business checkout_enabled = true
14. Verify the public Studio commercial manifest and checkout route.
15. Keep the separate **$99 one-time Shopify Founding Pilot** in its existing state unless a distinct launch decision explicitly publishes it.

## Fail-closed rule

If any required gate is absent or stale, activation stops. Do not substitute the $99 Shopify pilot, a sandbox provider, an old AppDeploy attestation, a customer-supplied receipt, or a general “Go” instruction for a missing commercial/payment approval.
