# Hercules Agent Execution Contract

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

This file applies to every agent, coding assistant, automation, continuation runner, and contributor operating in this repository.

Before changing anything, read and obey `governance/hercules-execution-contract-v1.json`, `CONTRIBUTING.md`, `IP_PROVENANCE.md`, and every governance or security policy relevant to the files being changed.

## Mandatory operating rules

1. Inspect the current canonical repository state before acting. Do not reconstruct shipped implementation from chat, memory, screenshots, drafts, or stale copies.
2. Continue from verified state. Do not duplicate, restart, or replace equivalent work that already exists.
3. Preserve owner-code, provenance, security, environment-separation, authorization, and fail-closed controls. Never weaken a gate just to make a build or test pass.
4. For behavior changes, establish the intended behavior with a failing or otherwise demonstrably pre-change test before implementation, then run the applicable focused and repository gates on the exact resulting head.
5. A statement such as implemented, complete, merged, deployed, healthy, connected, or fixed requires current evidence. If evidence is absent, report the precise unverified state instead.
6. When authorization or provider access blocks the preferred path, use a legitimate already-authorized equivalent route automatically when safe. Never bypass access controls, CAPTCHA/anti-bot checks, 2FA, consent, provider restrictions, or credential boundaries.
7. When browser execution is required, use the owned Hercules Browser first when it is available, authorized, and capable. External browser automation is fallback-only and the fallback reason must be recorded.
8. Stop only at a genuine owner-only boundary after all safe non-owner work is complete.
9. Before completion, run `node scripts/verify-hercules-execution-contract.mjs`. A failure is a blocker, not an advisory warning.

The machine-readable source for this contract is `governance/hercules-execution-contract-v1.json`.
