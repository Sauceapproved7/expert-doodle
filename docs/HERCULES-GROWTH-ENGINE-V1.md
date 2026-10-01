# Hercules Growth Engine v1

The Hercules Growth Engine unifies the existing SauceApproved marketing stack into one governed revenue loop.

## Capabilities

1. Creative Factory — governed creative planning and proof-bound variants.
2. Content Engine — multi-channel multiplication using the existing Content Multiplier.
3. Organic Traffic Engine — opportunity ranking weighted toward intent, relevance, and evidence rather than raw search volume.
4. Lead Capture System — attributable lead progression with explicit campaign/channel dimensions.
5. Campaign Brain — one campaign identity across creative, channel, checkout, purchase, and refund events.
6. Experiment Engine — minimum-sample and minimum-lift gates before a variant can be declared a winner.
7. Customer Intelligence — customer progression signals feed planning without exposing or requiring raw personal data in this core.
8. Marketing Command Center — full funnel plus net revenue, with revenue as the primary optimization signal.

## Hercules differentiators

- **Evidence Chain:** growth actions require evidence and public publishing remains a separate authorized action.
- **Revenue Memory Loop:** purchase/refund and funnel evidence can improve subsequent planning without allowing the planning layer to publish automatically.

## Existing systems reused

- SauceApproved Content Multiplier
- Hercules Campaign Forge
- Hercules Ad Studio
- SauceApproved Creation Floor

This is intentionally an orchestration layer, not a duplicate replacement.

## Safety and launch boundary

The engine is fail-closed. A generated plan has `publishReady: false` and each capability action has `publishAllowed: false`. Provider publishing, paid spend, storefront mutation, customer-data processing, and public claims remain behind their existing authorization and evidence gates.

## Verification

Focused behavior contract:

```sh
node --test tests/hercules-growth-engine.test.mjs
```

Repository merge gates remain mandatory:

```sh
node --test tests/hercules-implementation-enforcement.test.mjs
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```
