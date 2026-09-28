# SauceApproved Studios Market v1

## Purpose

SauceApproved Studios Market is the public discovery and founding-access layer for the owned SauceApproved Studio product line.

## Public offers

- SauceApproved Content Multiplier
- SauceApproved AI Sales Agent
- SauceApproved Brand Brain
- SauceApproved Studios Bundle

## Commercial state

Public product discovery is open and founding-pilot applications are open.

Paid checkout is intentionally disabled until the owner-controlled commercial gates are complete:

1. launch pricing approval;
2. Terms approval;
3. Privacy approval;
4. payout identity and destination verification;
5. controlled checkout verification; and
6. refund/reversal verification.

The market page does not accept a payment and does not imply that submitting a founding-access request creates a paid subscription.

## Demand attribution

Each product sends founding-access interest to the existing protected Hercules pilot intake using an owned UTM content identifier:

- `studio-content-multiplier`
- `studio-ai-sales-agent`
- `studio-brand-brain`
- `studio-bundle`

The destination is the existing Hercules launch surface and protected server-side marketing-contact flow.

## Truthfulness boundary

Market copy must not claim live third-party integrations, production ROI, testimonials, certifications, guaranteed outcomes, or provider availability without corresponding evidence. Product surfaces retain their existing fail-closed and approval-gated states.

## Verification

```sh
node --test tests/hercules-video-studio-server.test.mjs tests/hercules-video-studio-contract.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```
