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
16. **Shopify paid-order continuity:** when native `ORDERS_PAID` delivery is unavailable but the connected Shopify Admin API is authorized, follow `governance/hercules-shopify-paid-order-reconciliation-v1.json`. Reconcile only exact allowlisted Studio/Titan paid line items through `hercules_reconcile_verified_shopify_paid_order_v1`; never accept customer-supplied payment claims, never store raw buyer email, and never use reconciliation to change pricing, legal approvals, checkout/publication state, or other orders.

The full human-readable operating model is `governance/sauceapproved-master-gpt-operating-instructions-v1.md`.
The machine-readable source for enforceable execution controls is `governance/hercules-execution-contract-v1.json`.

## Codex-first engineering routing

For work in the canonical Hercules repository, prefer an available, authorized **Codex** coding task as the primary source-code implementation executor. This routing preference is not evidence that a persistent Codex environment, mobile executor, or paid provider is connected or enabled. An assistant must check the actual execution surface before claiming a task ran through Codex.

1. Begin with current canonical `main`, check existing pull requests and workspaces, and preserve already-verified implementation. Treat chats and temporary workspaces as supporting evidence, not shipped source.
2. Use a narrowly scoped feature branch and a reviewable pull request for source or policy changes; do not write directly to `main`. Keep the implementation and tests attributable to the exact resulting commit.
3. For behavior changes, write or demonstrate a failing pre-change test before implementation, then run focused tests, `node scripts/verify-hercules-execution-contract.mjs`, security/owner-code gates, and applicable CI checks. Never claim tests pass unless they were actually run on the relevant code.
4. Keep **prepared**, **committed**, **merged**, **deployed**, and **production-verified** as separate statuses. A passing test, pull request, preview URL, or healthy endpoint does not prove a paid order, payouts, customer access, or production readiness.
5. Preserve existing fail-closed safeguards. No repository task grants authority to change live Render/Railway, Shopify checkout or products, Stripe/payouts, DNS, Supabase access controls, public registration, customer data, legal policies, or production deployment without the required existing authorization and evidence.
6. Codex usage limits, missing environments, and unregistered execution bridges are blockers to Codex execution, **not** permission to impersonate Codex or bypass a provider. When Codex is unavailable, complete safe, authorized preparation and GitHub work using available tools, record the fallback and remaining dependency, and resume Codex only when it is genuinely available.
7. The Hercules mobile Codex bridge remains fail-closed until its authorized server-side HTTPS executor and credentials are independently configured and verified. Never store executor tokens in source control, client code, logs, or chat.
8. Report clearly: implementation surface used, commit/PR, exact-head tests, security checks, deployment state, and remaining blockers. Do not represent a saved instruction file as a registered Codex environment or a working unattended agent.
