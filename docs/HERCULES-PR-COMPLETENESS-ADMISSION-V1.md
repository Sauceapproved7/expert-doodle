# Hercules PR completeness admission — v1

The **Boil the Ocean** standard now has a pull-request admission check, rather than relying only on an agent to remember the standard. The check runs without production credentials, writes no data, and never deploys.

## What changes

Every material pull request created **or updated** on or after **2026-10-15T00:00:00Z** must include exactly one **changed** JSON manifest in `.hercules/completion-evidence/<slug>.json`. Only legacy PRs both created and last updated before the cutoff retain the exemption.

A material change is any changed path other than ordinary Markdown in `docs/` or root `README.md`, `CHANGELOG.md`. Markdown that controls completion, security, authorization, policy, execution contracts, or the threat model is **material** even under `docs/`. `CONTRIBUTING.md` is also material. Workflow, tests, application, assets, configuration, scripts, governance and security changes all count as material.

The manifest must:

- Use `schema: "sauceapproved.hercules.completion-evidence"` and `version: 1`.
- List **all** changed pull-request paths in `changedFiles`, including the manifest itself, with no duplicates.
- Pass `scripts/hercules-completeness-gate.mjs`: existing-state research, measurable acceptance criteria, evidence for every required phase, documented valid exclusions, and zero open threads.
- Never use `documentation-only` scope for a material PR.
- Preserve owner-only approvals, provider restrictions, security, and exact-head CI checks.

## GitHub CI

The existing `Hercules Universal Merge Gates` workflow checks new pull requests with `node scripts/hercules-pr-completeness-admission.mjs`. It checks the **GitHub-provided** PR creation and last-update timestamps and canonical repo name; the changed file inventory comes from `git diff` against the GitHub-provided base SHA. The workflow checks out the PR's merge commit at full history so Git can inspect all changes. A rejected PR gets a non-zero CI result.

Only older PRs that were **not updated after the cutoff** are grandfathered. A fresh commit or other GitHub-recorded PR update after the cutoff requires completion evidence; missing, contradictory, or malformed timestamps fail closed. Changes to control-plane Markdown documents also require evidence. This prevents stale PRs from being used as exemptions after adoption.

Branch protection must separately require the `Hercules Universal Merge Gates` status to make failing PR checks a server-enforced merge block. Without verified branch protection, this is a reproducible CI policy, **not** a guarantee that GitHub prevents merging via other routes. Maintainers should not merge if this check is red.

## Authoring evidence

For a material change, add `.hercules/completion-evidence/<change>.json` on the PR branch before filing the PR. Follow the example in `docs/HERCULES-BOIL-THE-OCEAN-V1.md` and provide the same changed-file set that the Git diff reports. Code changes need test evidence. Use `source-only` scope if this PR is not itself deploying production. Do **not** claim a live release until verified by deployment provider records.

Local preflight:

```sh
node --test tests/hercules-pr-completeness-admission.test.mjs tests/hercules-completeness-gate.test.mjs
node scripts/hercules-completeness-gate.mjs --manifest .hercules/completion-evidence/<change>.json --require-complete
```

In GitHub Actions the PR gate reads `GITHUB_EVENT_PATH` and emits a JSON decision. For privacy, it does not retrieve tokens or secrets. It rejects unsafe filenames, malformed metadata, missing manifests, self-declared doc-only scopes on material PRs, and evidence inventories that omit modified files.

## Limitations and security boundaries

This gate validates **structure and file existence**, not truth of claimed execution. Actual regression, security, release, and provider verification are established by independent exact-head CI checks and target-specific records. The CI script itself executes on the PR checkout; write permissions are not granted. Independent review, required status checks, CODEOWNERS protections, and repository branch rules remain necessary to prevent a malicious contributor from editing the gate itself.

The complete workflow remains: **research → acceptance → test → implement → security → document → release where applicable → verify → close threads**.


## Merge integrity requires the completion check (October 15, 2026)

The `universal-merge-gates` check is now required on **both** the post-merge main integrity guard's verified PR head and the future native GitHub App branch-protection configuration. This closes a prior mismatch where the completion-admission workflow could fail or never run but the after-the-fact guard would still accept other passing checks.

Three synchronized implementation surfaces:

- `scripts/hercules-main-guard.mjs` — fail closed when `universal-merge-gates` is absent or not successful.
- `.github/workflows/hercules-main-integrity-guard.yml` — collect the same required check by exact job name on the merged PR head.
- `supabase/functions/hercules-github-app/index.ts` — include the check when a properly installed GitHub App with repository administration permission activates server-side branch protection.

Test with:

```sh
node --test tests/hercules-main-guard.test.mjs tests/hercules-github-main-protection.test.mjs
```

**Do not confuse code correctness with provider enforcement.** A GitHub post-push restore is best-effort and cannot prevent an unprotected branch from receiving a merge or direct push. The native GitHub branch protection API requires an owner/admin or App installation token with repository Administration (write). The currently observed GitHub `main` branch is unprotected and the Hercules GitHub App registration is pending; neither deployment nor GitHub administrative activation is claimed by this source change.

Once an authorized GitHub App becomes available, verify the **actual** GitHub branch reports `protected=true`, requires `universal-merge-gates` and other critical checks, and disallows direct pushes and force pushes before declaring the branch protected. Do not publish or request tokens in chat or bypass account consent.
