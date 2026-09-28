# SauceApproved Content Multiplier v1

## Purpose

SauceApproved Content Multiplier converts one approved source into governed multi-channel content without silently changing protected brand facts.

## Core systems

- **Content DNA** — normalized brand vocabulary, tone, audience, offers, banned phrases and locked facts.
- **Variation Tree** — explicit parent/child lineage for hook, audience, tone, platform, length and offer branches, with duplicate sibling protection.
- **Content Opportunity Radar** — identifies unused source moments and locked brand facts that have not yet been developed into content.
- **Variant Fatigue Guard** — detects near-duplicate variants before more repetitive content is produced.

## Trust model

Generation is fail-closed. The core returns `generation_provider_unavailable` when no generator is injected. A connected generator receives the Content DNA constraints. Returned assets are validated against locked fact bindings and banned phrases before they are accepted.

The module does not claim a connected model provider, publishing account, analytics feed or social network unless that integration is separately configured and verified.

## Runtime ownership

The module uses repository-owned JavaScript and Node.js built-ins only. No vendored or third-party runtime source is included.

## Verification

```sh
node --test tests/sauceapproved-content-multiplier.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```

The architecture benchmark is not represented as production-scale evidence. Live integrations, load behavior and conversion impact require separate measured verification.
