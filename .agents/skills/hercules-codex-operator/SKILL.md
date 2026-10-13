---
name: hercules-codex-operator
description: Apply Hercules owner-code, test-first, and release-evidence procedures to Codex Cloud setup or Hercules coding tasks inside the Sauceapproved7/expert-doodle repository. Use for coding, debugging, test preparation, safe change triage, or environment readiness. Do not use to grant provider access, deploy production, or publish a Codex environment.
---

# Hercules Codex Operator — repository-local instructions

Use the current GitHub checkout of `Sauceapproved7/expert-doodle` as the only implementation authority. Start by reading `AGENTS.md`, `CONTRIBUTING.md`, `governance/hercules-execution-contract-v1.json`, `governance/sauceapproved-master-gpt-operating-instructions-v1.md`, and `IP_PROVENANCE.md`. Identify the current branch and exact commit. Do not replace verified existing code with guesses from a prior chat.

## 1. Diagnose safely

From the repository root, use only the existing source-controlled diagnostic commands:

```sh
node scripts/hercules-codex-cloud-handoff.mjs --json
node scripts/hercules-codex-doctor.mjs --json
```

Read the JSON literally. Local file presence is not proof of cloud registration, executable tool permissions, or test success. Cloud environment publication is an account-side action. Do not claim a published Codex Cloud environment without authoritative account evidence and a successful task using that published environment.

Codex Cloud computer and browser use are not supported in the current official Cloud documentation. For browser tasks, use a separately authorized Hercules Browser control surface when available; do not treat the Codex Cloud VM as a browser. Respect an actual Codex usage limit instead of attempting to evade it or claiming a task ran.

## 2. Implement using test-first workflow

- Inspect current code and its existing tests before changing behavior. Add a focused regression test that fails against the old behavior, then implement the smallest robust fix.
- Preserve original SauceApproved code, declared third-party provenance and licensing, strict source roots, and staging/customer/production separation.
- Use an isolated branch and a reviewable pull request for coding changes. Evaluate impacted paths with `node scripts/hercules-codex-doctor.mjs --json --changed ...` before making sensitive changes. That classification is advisory, not permission.
- Run focused tests, then the repo preflight:

```sh
node scripts/hercules-preflight.mjs
```

- Confirm the CI checks on the **exact head**: implementation enforcement, owner-code, security baseline, secret scan, provenance, workflow checks and CodeQL when relevant. Record what ran, the SHA, pass/fail status, and what is unknown. Do not merge an unverified or failing head, or bypass GitHub release protections.

## 3. Preserve owner and commercial authority

Do not perform a production deploy, change payment processing, obtain or expose private credentials, modify customer entitlements, change DNS or checkout, or grant new provider permissions as part of ordinary coding readiness. Any such action requires the independent authorization and release gates already described by Hercules governance. No GitHub merge, green local test, or cloud setup can replace those gates.

## 4. Report in evidence order

Report: **Changed → Verified → Not verified/blocked → Next safe action**. Separate repository state, GitHub CI, Codex account publication, Codex runtime ability, and production readiness. If a cloud environment is missing, finish repository-side safe work and identify only the remaining native Codex web/desktop `Create environment → Get started → Publish` step. Do not imply the step has been performed.

Original Hercules instructions only. No external network, credential, payment, or production privileges are provided by this skill.
