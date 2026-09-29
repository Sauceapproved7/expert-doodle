# Hercules Commercial Owner Approval Packet — 2026-09-29

Status: PREPARED FOR OWNER REVIEW — NO APPROVAL INFERRED

## Pricing

Two incompatible pricing systems exist and must be resolved by explicit owner approval.

### Launch Approval Envelope v2
- Starter: $49/month or $490/year
- Pro: $149/month or $1,490/year
- Scale: $399/month or $3,990/year

### Legacy software candidate catalog
- Starter: $29/month
- Pro: $79/month
- Agency: $199/month

The legacy catalog remains referenced in live code, offer pages, database state, and tests. Checkout remains disabled. No price is approved by this packet.

## Terms candidate

Source: `docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md`

The Terms candidate is not effective. Before activation the owner must expressly approve:

1. Final launch pricing.
2. Cancellation and refund language.
   - Current candidate: subscriptions renew monthly until canceled.
   - Cancellation takes effect at end of paid period unless law/agreement requires otherwise.
   - Current candidate refund rule: fees already paid are non-refundable except where law or written promise requires otherwise, with discretionary refunds/credits allowed.
3. Liability limitation.
   - Current candidate cap: fees paid/payable during prior 12 months; fallback US $100 if no fees were paid.
4. Indemnification.
   - Current candidate applies to third-party claims from unlawful use, unauthorized customer content, or publication/distribution violating law, rights, or Terms.
5. Connecticut governing law and venue.
   - No mandatory arbitration or class-action waiver is activated by the current candidate.
6. A monitored business support/legal contact.
7. Payment-provider flow verification.
8. Confirmation that Privacy wording matches production behavior.

## Privacy candidate

Source: `docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md`

The Privacy candidate is not effective. Before activation the owner/system must resolve:

1. Current AI/render provider chain for Studio and Ads.
2. Stripe payment-data flow.
3. Actual production retention behavior.
4. Jurisdiction-specific disclosures for the real launch markets.
5. Monitored privacy/support request channel.
6. Consistency with final Terms and production products.

Current infrastructure described by the candidate:
- Supabase
- Render
- GitHub
- Stripe after commercial activation
- additional AI/render providers only after they are documented as active subprocessors

## DA-27 no-charge preflight

The following can be verified without taking payment:

- Stripe/payment provider credentials exist and are recognized by Hercules.
- Checkout remains disabled while approvals are pending.
- No active price ID or runtime guard points at an unapproved amount.
- Billing entity is SauceApproved enterprise LLC where provider/account configuration permits verification.
- Public offer copy does not represent an unapproved catalog as active pricing.
- Refund/cancellation behavior in checkout configuration matches the final approved Terms.
- Webhook and entitlement handlers fail closed on unknown product/price mappings.
- Test mode, dry-run, or configuration inspection is used before any live controlled charge.
- No customer-facing public paid path is opened before controlled checkout/refund evidence exists.

## Owner-only gates

The following cannot be inferred from a generic "go":

- Pricing approval
- Terms approval
- Privacy approval
- Bank login or payout authorization
- Identity verification
- Acceptance of payment-provider terms
- Authorization to make a real charge
- Authorization to execute a real refund

## Execution sequence after approvals

1. Record explicit owner approval for pricing.
2. Reconcile legacy pricing footprint using a forward migration and runtime updates.
3. Record explicit owner approval for Terms.
4. Record explicit owner approval for Privacy.
5. Run no-charge configuration verification.
6. Complete any owner-only Stripe/bank/identity steps.
7. Run one controlled paid checkout.
8. Verify entitlement and payout state.
9. Refund/reverse the controlled charge.
10. Verify refund state and no unintended residual charge.
11. Record evidence in DA-27 and rerun the Hercules launch gate.
