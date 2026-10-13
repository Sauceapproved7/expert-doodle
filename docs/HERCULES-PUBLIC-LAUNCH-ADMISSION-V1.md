# Hercules public-launch admission v1

## Scope

The canonical Hercules release gate is `governance/hercules-release-gate-v1.json`, evaluated by `scripts/hercules-release-gate.mjs`. This adapter makes the existing gate an **executed CI check** for public-launch candidate tags, rather than merely checking that the gate policy exists.

The read-only admission checker is `scripts/hercules-public-launch-admission.mjs`. It does not deploy software, publish offers, approve documents, enable paid checkout, or change the `public-registration-open` switch. Runtime signup remains governed by the existing Supabase `hercules-launch-gate` and owner-controlled public registration switch.

## Automatic trigger

Pushing a tag matching `hercules-public-v*` triggers the `Hercules Release Gate v1` workflow. Its public-launch job:

1. runs the owner-code, policy and fail-closed contract tests;
2. verifies the tagged commit has exactly one parent and changes only `releases/public-launch/evidence.json`;
3. checks that the evidence packet binds to the exact **parent source commit** of the evidence-only release commit, then rejects mismatched SHA, invalid schema, non-production evidence, stale or future-dated evidence, or any false/missing required check;
4. exits nonzero and does not authorize a launch unless every check passes.

The packet structure is:

```json
{
  "schema": "sauceapproved.hercules.public-launch-admission",
  "version": 1,
  "environment": "production",
  "sourceCommit": "<40-character lowercase SHA of the parent source commit>",
  "checkedAt": "<ISO-8601 UTC timestamp including milliseconds>",
  "evidence": {
    "build": {},
    "security": {},
    "deployment": {},
    "rollback": {},
    "smoke": {},
    "domain": {},
    "commercial": {},
    "release": {}
  }
}
```

All evidence properties listed in `governance/hercules-release-gate-v1.json` must be **true**. Missing fields are blockers. Evidence must be no older than 60 minutes and no more than 60 seconds in the future, relative to workflow execution. The JSON packet is capped at 64 KiB. To avoid a circular commit hash, first finalize source code, then create a separate single-parent commit that changes **only** `releases/public-launch/evidence.json` and references that source commit. Tag the evidence-only commit with `hercules-public-v*`. GitHub Actions verifies the exact parent SHA and evidence-only diff. A tag on an arbitrary commit fails closed.

### Evidence trust boundary

A JSON boolean alone does not independently prove a real payment, a completed domain cutover, a security approval, or an owner decision. The producer of each field must supply genuine, current, independently verified source evidence before a packet can be committed. Reviewers must check that provenance, especially for owner-only approvals. The CI runner checks completeness, release identity and freshness, but **does not replace provider-side attestation**.

In particular, tagging a commit never opens registration or activates payment. Live public-release controls remain independently owner-controlled. A green CI result is only candidate admission, not a claim that an end-to-end production launch occurred.

## Verification

```bash
node scripts/hercules-release-gate.mjs --verify-policy
node --test tests/hercules-release-gate-v1.test.mjs tests/hercules-public-launch-admission.test.mjs
node scripts/hercules-public-launch-admission.mjs \
  --evidence releases/public-launch/evidence.json \
  --commit <parent-source-sha>
```

The CLI reports the exact blockers and fails closed with a nonzero exit code.

## Provenance

- Source: project-authored SauceApproved/Hercules code created with AI assistance.
- Runtime dependencies: Node.js built-ins and the already-owned release-gate evaluator only.
- Third-party infrastructure: GitHub Actions provides workflow execution, not the Hercules gate policy or ownership of source.
- Differentiators: exact source-commit binding, and freshness-limited release evidence.
- No secrets, external runtime libraries, or third-party proprietary code are included.
