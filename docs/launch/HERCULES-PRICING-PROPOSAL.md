# Hercules Revenue Recovery — Canonical Launch Pricing

**Status:** PRODUCTION-CATALOG ALIGNED — OWNER APPROVAL PENDING  
**Entity:** SauceApproved Enterprise LLC

This document now matches the active Hercules production plan catalog. It does not activate Stripe billing or substitute for the authenticated owner approval required by the launch gate.

## Starter — $49/month or $490/year

For small owner-operated businesses starting with the controlled Revenue Recovery workflow.

- active plan code: `starter`
- one primary workspace foundation
- core recovery workflow
- owner approval controls
- evidence / reason history
- standard usage allowance

## Pro — $149/month or $1,490/year

For businesses with a larger receivables operation.

- active plan code: `pro`
- expanded usage allowance
- broader team/workspace use
- advanced recovery history
- priority operational support
- verified integrations as enabled

## Scale — $399/month or $3,990/year

For higher-volume teams requiring stronger operational controls.

- active plan code: `scale`
- higher usage allowance
- advanced workspace roles
- export / audit workflows
- deployment and integration support
- higher-touch onboarding

## Billing activation rule

The catalog above is the canonical price source for launch closeout because it already matches the active production database.

Paid billing remains inactive until all of the following are true:

1. the owner approves the pricing decision through the authenticated Hercules Launch Decision Center;
2. Stripe is connected and the account/payout setup is verified by Stripe;
3. Stripe products/prices and checkout are verified against these exact amounts;
4. webhook signing and subscription-state synchronization pass;
5. Terms and Privacy are approved and reflect the live billing flow.

## Commercial guardrails

- No outcome-based collection fee is enabled at launch.
- Do not charge for a capability that is not live.
- Usage limits shown in-product must come from the same entitlement source enforced by Hercules.
- Provider payment status is not sufficient authorization for an entitlement change; Hercules must verify entitlement state server-side.
- Public registration remains a separate explicit release gate.
