# DA-33 Pricing Reconciliation Manifest

Date: 2026-09-29
Status: NO-CHARGE / NO-PRICE-CHANGE PREPARATION ONLY

## Current conflict

Two incompatible pricing catalogs exist in the Hercules codebase and launch state.

### Legacy software catalog
- Starter: $29/month
- Pro: $79/month
- Agency: $199/month
- Status: owner_approval_required
- Checkout remains disabled

### Launch Approval Envelope v2
- Starter: $49/month or $490/year
- Pro: $149/month or $1,490/year
- Scale: $399/month or $3,990/year
- Status: owner approval still required

No catalog is to be activated until explicit owner pricing approval is recorded.

## Legacy pricing footprint identified

The $29 / $79 / $199 catalog is referenced in at least these paths:

- `supabase/functions/hercules-integrations/index.ts`
  - catalog readiness logic expects Starter 2900 cents.
- `supabase/functions/hercules-private-bridge/index.ts`
  - legacy software commercial bundle pricing: starter 2900, pro 7900, agency 19900.
- `supabase/functions/hercules-provider-connect/index.ts`
  - `SOFTWARE_PRICE_GUARD={starter:2900,pro:7900,agency:19900}`.
- `supabase/migrations/20260928100000_hercules_software_commercial_bundle_v1.sql`
  - validates only 2900 / 7900 / 19900.
- `supabase/migrations/20260928093000_hercules_software_checkout_activation_v1.sql`
  - writes starter/pro/agency cents as 2900 / 7900 / 19900.
- `supabase/migrations/20260928090000_hercules_owned_software_commerce_v1.sql`
  - seeds Studio and Ads pricing at 2900 / 7900 / 19900.
- `hercules-forge/product-packages.mjs`
  - candidate monthly USD 29 / 79 / 199.
- `docs/HERCULES-FORGE-PRODUCT-PACKAGES-V1.md`
  - documents the same candidate pricing.
- `hercules-forge/offers/sauceapproved-ads/index.html`
  - publicly displays planned 29 / 79 / 199 pricing.
- `hercules-forge/offers/sauceapproved-studio/index.html`
  - publicly displays planned 29 / 79 / 199 pricing.
- `tests/hercules-forge-software-checkout-activation.test.mjs`
  - asserts legacy prices and explicitly rejects 4900 / 14900 / 39900.
- `tests/hercules-forge-software-commercial-bundle.test.mjs`
  - asserts 2900 / 7900 / 19900.
- `tests/hercules-forge-software-payment-path.test.mjs`
  - asserts 2900 / 7900 / 19900.
- `tests/hercules-forge-software-commerce-shell.test.mjs`
  - asserts $29 / $79 / $199 presentation.
- `tests/hercules-forge-product-packages.test.mjs`
  - asserts candidate monthly 29 / 79 / 199.

## v2 catalog footprint identified

`supabase/functions/hercules-private-bridge/index.ts` also contains Launch Approval Envelope v2 pricing:

- starter monthly 4900 / annual 49000
- pro monthly 14900 / annual 149000
- scale monthly 39900 / annual 399000

This confirms the repository currently carries two incompatible pricing systems.

## Safe reconciliation sequence after owner approval

1. Record explicit owner approval for one catalog.
2. Freeze checkout while reconciliation runs.
3. Replace the stale catalog in runtime guards, provider guards, offer pages, package definitions, and canonical docs.
4. Add a forward migration that updates database product-plan rows; do not rewrite historical migrations.
5. Update tests to assert only the approved active catalog.
6. Add a negative test that fails if legacy price constants remain in active runtime paths.
7. Verify commercial bundle digest/version changes.
8. Verify launch approvals table matches the approved catalog.
9. Run no-charge checkout configuration verification.
10. Only then proceed to controlled paid checkout/refund verification under DA-27.

## Hard controls

- Do not authorize or capture a payment from this manifest.
- Do not infer pricing approval from a generic "go".
- Do not enable commerce until pricing, Terms, Privacy, and payment-path verification gates pass.
- Historical migration files should remain immutable; use a new reconciliation migration.
