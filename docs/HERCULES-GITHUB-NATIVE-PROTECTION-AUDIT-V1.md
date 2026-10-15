# Hercules GitHub native-main protection audit — v1

## Purpose

Hercules has a source-level post-merge integrity guard and a Boil the Ocean completeness-admission check. Those **do not** replace GitHub server-enforced branch protection. The public GitHub branch endpoint reported `main.protected=false` on October 15, 2026. The managed connected GitHub App lacks GitHub repository Administration permission, and the Hercules-owned GitHub App registration was pending without an installed credential reference.

This audit makes the missing native protection visible automatically instead of allowing a green source-level test to be mistaken for a protected branch.

## Design and ownership

- Original no-dependency Node script: `scripts/hercules-native-main-protection-audit.mjs`.
- Node's public `fetch` reads only `https://api.github.com/repos/Sauceapproved7/expert-doodle/branches/main`.
- Does **not** read secrets, request user tokens, modify GitHub settings or deploy anything.
- Imports its required status checks from the existing `scripts/hercules-main-guard.mjs` list, including `universal-merge-gates`, so policies cannot silently diverge.
- Validates the exact branch, SHA and `protected` boolean; requires active required status check names in readable metadata. Missing evidence fails closed.
- For a protected branch, even all expected status checks observed by the public endpoint **cannot prove** administrator enforcement, review requirements, special bypass permissions, or effective ruleset semantics. The result explicitly records `administrativeEnforcementVerified:false`.

## Schedule and alerts

The existing `.github/workflows/hercules-github-main-protection.yml` runs the audit on daily `13:17 UTC` schedule and on manual workflow dispatch. GitHub may delay a scheduled run and may disable schedules in inactive public repositories. An unprotected or unverifiable branch results in a failing Actions job, visible in GitHub's Actions history. This job is excluded from ordinary pull-request events to avoid blocking legitimate changes while the native-permission boundary remains open.

The workflow's original source-level protection tests remain active for pull requests and main pushes.

## Verify and recover

Run the no-provider tests on a trusted checkout:

```sh
node --test tests/hercules-native-main-protection-audit.test.mjs tests/hercules-github-main-protection.test.mjs
node scripts/verify-hercules-execution-contract.mjs
```

A real manual Actions run requires network access to GitHub and returns a JSON report. When `main` is unprotected, the expected result is `ok:false` with `reason:"main_unprotected"`; this **is a correctly functioning alarm**, not a reason to silence it.

To resolve the remaining native issue, a GitHub owner/admin must grant a legitimate GitHub App or authorized administrator the repository Administration permissions needed to configure branch protection, then apply a rule for `main` requiring pull requests, up-to-date status checks (including `universal-merge-gates` and the other Hercules checks), and restrictions on bypass, force pushes and deletions. Recheck GitHub's **actual** protected flag and full authoritative protection settings with the appropriately authorized account. Do not send credentials or approval codes in chat.

The runbook deliberately does not impersonate the repository owner or try to work around permissions. An auditor result of `ok:true` proves only what the public branch endpoint exposes, not full administrative enforcement.
