# SauceApproved Brand Brain v1

## Purpose

SauceApproved Brand Brain is the governed source-of-truth layer for approved brand facts, provenance, Brand Constitution rules, inherited brand policy, cross-channel consistency review, and downstream impact analysis.

## Core systems

- **Brand Constitution** — versioned hard rules and soft preferences with precedence, channel overrides, conflict detection, inheritance, and explicit child-brand overrides.
- **Cross-Channel Consistency Simulator** — identifies contradictions across price, CTA, disclosure, promise, audience, and timing without silently rewriting approved data.
- **Rule Blast Radius Preview** — shows which downstream assets, agents, and campaigns would be affected by a proposed rule before activation.
- **Brand Drift Time Machine** — compares Constitution versions and evaluates the same asset against both versions.

## Trust model

- Approved facts carry source provenance.
- Locked facts cannot be silently overwritten.
- All fact changes are proposals with `review-required` state; Brand Brain does not auto-apply learning.
- Conflicting hard rules at identical precedence are rejected.
- Parent-brand rules can be inherited by child brands, while explicit higher-precedence child overrides remain visible.
- Cross-channel simulation reports contradictions but does not auto-correct them.
- The module does not claim live DAM, CMS, Figma, design-system, website, document, or knowledge-base integrations unless separately configured and verified.

## Verification

```sh
node --test tests/sauceapproved-brand-brain.test.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
node scripts/verify-hercules-execution-contract.mjs
```

Architecture benchmark scores are not production-scale evidence. Visual governance depth, third-party connectors, enterprise permission models, load behavior, and compliance evidence require separate measured verification.
