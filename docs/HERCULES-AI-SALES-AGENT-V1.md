# SauceApproved AI Sales Agent v1

## Purpose

SauceApproved AI Sales Agent is an owned, fail-closed sales intelligence core for grounded recommendations, objection analysis, consent-based lead capture, safe handoff decisions, and policy-controlled business actions.

## Core systems

- **Adaptive Pitch Memory** — retains only explicitly stated, non-sensitive sales context within the active customer session, such as budget range, desired outcome, priorities, preferences, and objections.
- **Objection Intelligence Map** — clusters explicit buyer objections into reviewable business-friction evidence without inferring sensitive traits.
- **Confidence-to-Handoff Governor** — decides whether to answer, clarify, or hand off using approved-knowledge support, locked-fact coverage, ambiguity, and action risk.
- **Objection-to-Asset Bridge** — converts recurring objection clusters into review-required Content Multiplier briefs rather than silently publishing or modifying brand truth.

## Trust model

- Recommendations are drawn only from approved active products.
- If approved knowledge cannot support a recommendation, the agent returns `approved_knowledge_insufficient` and recommends handoff.
- Lead capture requires explicit consent.
- Sensitive profiling is not allowed.
- Business actions require both an explicit allowlist and an injected action adapter.
- If the action adapter is absent, execution fails closed with `sales_action_adapter_unavailable`.
- The core does not claim live CRM, helpdesk, booking, messaging, checkout, email, SMS, or voice integrations unless separately configured and verified.

## Sensitive-data boundary

Adaptive Pitch Memory accepts only explicit sales context. Sensitive categories including race, ethnicity, religion, health, disability, sexual orientation, political preference or affiliation, trade-union membership, criminal history, biometric data, and sex-life data are not retained in the sales memory contract.

## Verification

```sh
node --test tests/sauceapproved-ai-sales-agent.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```

Architecture benchmark scores are not production-scale evidence. Live conversion performance, third-party integrations, omnichannel execution, and production load behavior require separate measured verification.
