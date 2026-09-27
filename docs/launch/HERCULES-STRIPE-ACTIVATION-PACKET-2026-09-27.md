# Hercules Stripe Activation Packet — 2026-09-27

**Status:** READY FOR OWNER PAYMENT-AUTHORIZATION STEP  
**Entity:** SauceApproved Enterprise LLC

## Canonical pricing

- Starter — $49/month or $490/year
- Pro — $149/month or $1,490/year
- Scale — $399/month or $3,990/year

These values match the active Hercules production plan catalog.

## Hercules-side implementation

The existing `hercules-provider-connect` control surface already:

- validates a submitted Stripe secret key against the Stripe account API;
- stores the secret in Supabase Vault rather than source code or browser storage;
- creates or reuses the Hercules Stripe webhook endpoint;
- subscribes to checkout, subscription, and invoice payment lifecycle events;
- stores only Vault references plus non-secret account/webhook metadata.

The Hercules Integrations UI now exposes an owner-facing **Stripe Direct** card with a password-masked secret-key field. The field is cleared immediately after the connection attempt and the stored secret is never rendered back to the browser.

## Owner-only steps that cannot be automated safely

1. Create or finish the Stripe account for SauceApproved Enterprise LLC.
2. Complete Stripe identity/business verification.
3. Connect the approved SauceApproved business payout bank account inside Stripe.
4. Obtain the appropriate Stripe secret key and enter it only in the authenticated Hercules Integrations Stripe Direct card.

Do not paste Stripe or bank credentials into chat.

## Automatic continuation after the key is supplied

Hercules will validate the Stripe account, configure/reuse the signed webhook receiver, store the credential in Vault, and record the provider connection.

Before paid public release, verify:

- the connected Stripe account is the intended SauceApproved business account;
- live/test mode matches the intended launch mode;
- product/price objects match the canonical Hercules catalog;
- checkout creates the correct subscription/plan entitlement;
- subscription update/cancellation is reflected in Hercules;
- invoice success/failure events are signed and processed;
- no raw card data is stored by Hercules;
- one controlled checkout/cancel/refund test passes.

## Release rule

Paid billing must remain unavailable until the owner-bound payment setup is complete and the launch gate is green. Public registration remains a separate explicit release switch.
