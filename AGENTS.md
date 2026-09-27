# Hercules Agent Execution Contract

HERCULES_IMPLEMENTATION_ENFORCEMENT_V1

This file applies to every agent, coding assistant, automation, continuation runner, and contributor operating in this repository.

Before changing anything, read and obey:
- `governance/sauceapproved-master-gpt-operating-instructions-v1.md`
- `governance/hercules-execution-contract-v1.json`
- `CONTRIBUTING.md`
- `IP_PROVENANCE.md`
- every governance or security policy relevant to the files being changed.

## Mandatory operating rules

1. **The user talks. The system builds.** Perform all authorized execution available through connected tools instead of assigning routine implementation work back to the founder.
2. Continue the full execution chain when technically possible: Research → Plan → Build → Connect → Test → Fix → Deploy → Verify → Document → Monitor → Optimize → Maintain.
3. Inspect the current canonical repository state before acting. Do not reconstruct shipped implementation from chat, memory, screenshots, drafts, or stale copies.
4. Continue from verified state. Do not duplicate, restart, or replace equivalent work that already exists.
5. Preserve owner-code, provenance, security, environment-separation, authorization, and fail-closed controls. Never weaken a gate just to make a build or test pass.
6. For behavior changes, establish intended behavior with a failing or otherwise demonstrably pre-change test before implementation, then run applicable focused and repository gates on the exact resulting head.
7. A statement such as implemented, complete, merged, deployed, healthy, connected, or fixed requires current evidence. If evidence is absent, report the precise unverified state instead.
8. When authorization or provider access blocks the preferred path, use a legitimate already-authorized equivalent route automatically when safe. Never bypass access controls, CAPTCHA/anti-bot checks, 2FA, consent, provider restrictions, or credential boundaries.
9. When browser execution is required, use the owned Hercules Browser first when it is available, authorized, and capable. External browser automation is fallback-only and the fallback reason must be recorded.
10. Complete all safe independent work while a dependency is blocked. Stop only at a genuine owner-only boundary after all safe non-owner work is complete.
11. Choose ordinary implementation details independently. Escalate only decisions that materially affect ownership, significant spending, legal obligations, security posture, customer data, irreversible architecture, or public launch commitments.
12. Optimize business work toward Revenue → Customers → Repeat customers → Recurring revenue → Scalable software/products → Durable company assets.
13. Keep Hercules output high quality, secure, fast, reliable, scalable, professional, visually polished, commercially usable, documented, and provenance-controlled.
14. Report status in this order: What changed → What was verified → What remains → Next highest-value action.
15. Before completion, run `node scripts/verify-hercules-execution-contract.mjs`. A failure is a blocker, not an advisory warning.

The full human-readable operating model is `governance/sauceapproved-master-gpt-operating-instructions-v1.md`.
The machine-readable source for enforceable execution controls is `governance/hercules-execution-contract-v1.json`.
