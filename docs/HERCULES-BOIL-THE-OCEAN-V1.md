# Hercules "Boil the Ocean" completion standard (v1)

**Owner directive:** When Sauce requests a build, deliver the entire authorized outcome, not an outline. Find and reuse existing work first. Define acceptance criteria before writing code. Write failing tests for behavioral changes. Implement, test, document, connect, ship where authorized, and verify. Do not defer an in-scope permanent solution because a workaround is easier.

**Non-negotiable accuracy:** AI can reduce the marginal effort of thoroughness; it does not make verification, external dependencies, safety, money, or physical deployment free. "Complete" describes evidence, not confidence or ambition.

## Definition of done

1. **Research before building.** Inspect canonical main, requirements, previous attempts, dependencies, providers, and current standards. Record findings and source files. Prefer a permanent fix to a workaround when safe and authorized.
2. **Define the finished product.** Write a measurable intended outcome and acceptance criteria covering happy path, failure path, security, UX/accessibility where relevant, integration and rollback.
3. **Test first.** For behavioral code changes, record pre-change failing tests (RED); implement the minimum to turn them GREEN; refactor and run focused, integration, and applicable full-suite tests. For docs-only work, document the justified omission.
4. **Ship all in-scope pieces.** Include code/configuration, connection, migrations, observability, rollback, operational documentation, and deployment when explicitly in scope. Avoid unnecessary new services and preserve existing production workloads.
5. **Close every thread.** Track dependencies and outstanding issues explicitly. Resolve all actionable safe work; do not call the feature complete with unresolved scope-critical issues. If an owner-only or provider constraint remains, report the precise block and label the result **not complete**.
6. **Evidence before claims.** Record commands, results, paths, linked reviews, exact revision, live-service evidence when applicable, and security limitations. A local test is not live deployment. A drafted policy is not a deployed control. A source file is not proof a remote provider acted.
7. **Review and maintain.** Use PR review and exact-head CI. Do not merge if required checks are red. Monitor only when a real scheduled process is verified, and include handoff/runbook and failure recovery information.
8. **Do the full job within authorization.** Never bypass consent, 2FA, provider restrictions, owner-only decisions, money rails, or launch/security gates to meet the completeness target.

## Machine gate

The executable gate is `scripts/hercules-completeness-gate.mjs`. It takes a JSON evidence manifest and checks:

- explicit project outcome, scope, existing-state research and criterion-by-criterion acceptance evidence;
- an exact set of eight phases: `research`, `design`, `implementation`, `tests`, `security`, `documentation`, `release`, `verification`;
- each phase has an existing local evidence file when marked `verified`;
- a `not_applicable` phase has an explicit substantive reason; only `release` may be waived by default, and `tests` or `implementation` only for documentation-only work; security and verification cannot be waived; deployment cannot be waived for staging or production scope;
- no unresolved `openThreads`, failed/unverified/blocked phases, duplicate IDs, missing files, traversal paths or escaping symlinks.

Manifest skeleton:

```json
{
  "schema": "sauceapproved.hercules.completion-evidence",
  "version": 1,
  "title": "Example scoped feature",
  "intendedOutcome": "Customer can complete feature X with auditable evidence",
  "scope": "source-only",
  "research": [
    {
      "question": "What exists already?",
      "finding": "Reused the canonical authenticated endpoint",
      "evidencePaths": ["AGENTS.md"]
    }
  ],
  "acceptance": [
    {
      "id": "A1",
      "requirement": "Unauthorized calls are denied",
      "status": "verified",
      "evidencePaths": ["tests/hercules-completeness-gate.test.mjs"]
    }
  ],
  "phases": [
    {"id":"research","status":"verified","evidencePaths":["AGENTS.md"]},
    {"id":"design","status":"verified","evidencePaths":["AGENTS.md"]},
    {"id":"implementation","status":"verified","evidencePaths":["scripts/hercules-completeness-gate.mjs"]},
    {"id":"tests","status":"verified","evidencePaths":["tests/hercules-completeness-gate.test.mjs"]},
    {"id":"security","status":"verified","evidencePaths":["SECURITY.md"]},
    {"id":"documentation","status":"verified","evidencePaths":["docs/HERCULES-BOIL-THE-OCEAN-V1.md"]},
    {"id":"release","status":"not_applicable","reason":"This change only updates repository source and does not request deployment"},
    {"id":"verification","status":"verified","evidencePaths":["tests/hercules-completeness-gate.test.mjs"]}
  ],
  "openThreads": []
}
```

Example manifest paths illustrate format **only**, not actual successful tests or deployed acceptance. Evidence files must substantively support their claims; the gate checks their existence and safe location but cannot authenticate their contents or remote states.

Run on the exact source being evaluated:

```sh
node --test tests/hercules-completeness-gate.test.mjs
node scripts/hercules-completeness-gate.mjs --manifest path/to/change-evidence.json --require-complete
node scripts/verify-hercules-execution-contract.mjs
node scripts/verify-owner-code-only.mjs
node scripts/security-baseline.mjs
```

CI independently runs the tests and execution-contract verifier. For production claims, independently confirm deployment revision, live functional checks, security behavior, rollback and monitoring from the provider. Only assert `merged` once GitHub confirms merge, and `deployed` once the actual target confirms the exact revision.

## Two Hercules differentiators

**Closure inventory:** machine-readable phase and acceptance evidence with unresolved threads made visible rather than buried in a cheerful summary.

**Scope-aware fail-closed release:** documentation-only and source-only changes may explicitly waive deployment; anything promising staging or production cannot. Security and owner-only gates remain stronger than the desire to ship.

## Reporting format

**Changed → Verified → Remaining → Next highest-value action.** If anything required is blocked, state the blocker and that the build is not yet complete. The completion gate validates evidence structure; reviewers and independent CI/provider checks establish its truth.
