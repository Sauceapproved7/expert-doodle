# Hercules Codex Doctor v1 — offline readiness and change-impact report

This is a **first-party, standard-library-only, read-only diagnostic** for Hercules coding work. It does not install Codex, make cloud registration work, enter credentials, invoke providers, modify files, open a deployment, or certify production release.

## Commands (from the repository root, Node.js 22+)

Human-readable local preflight:

    node scripts/hercules-codex-doctor.mjs

Structured output suitable for a coding-agent review:

    node scripts/hercules-codex-doctor.mjs --json --changed tests/example.test.mjs governance/hercules-execution-contract-v1.json

To actually run the existing repository verification suite separately:

    node --test tests/hercules-codex-doctor.test.mjs
    node scripts/hercules-preflight.mjs

The Doctor's JSON reports distinct evidence categories:

- **local.prerequisites_present** means checked-in governance/build entrypoints were found, and the local Node major version is supported. It **does not** mean tests passed.
- **local.blocked** means at least one mandatory marker is missing, or the local Node major version is not known to be supported. Exit status is nonzero.
- **remote.unverified** is always reported. Local filesystem checks cannot prove Codex Tasks environment registration, repository mount, GitHub permissions, attached terminals, or cloud execution.
- **checks.not_run** is always reported: the Doctor itself does not execute the tests, even when its status is green.
- **proposedChanges.isolated / review_required / blocked** is advisory classification of requested relative file paths. It never grants permission to edit, merge, deploy, authorize payments, or change checkout. Invalid or traversing paths fail closed.

A review-required path does not mean the file is prohibited, only that it crosses a significant governance, infrastructure, signing, finance, or credential boundary. The guard intentionally provides no blanket approval for other paths; any unlisted critical path still requires all existing authorization and security controls.

## Hercules differentiators

1. **Evidence-truth separation:** local repository prerequisite evidence and remote cloud registration evidence cannot be confused, and a successful Doctor cannot be presented as a passed security suite.
2. **Change-impact preview:** explicit per-path risk explanations flag high-impact changes before Codex creates a pull request, while rejecting malformed or escaping paths and never granting privileged action authority.

## Deployment and ownership boundary

All Doctor source and tests are original SauceApproved JavaScript authored with AI assistance, without new dependencies or copied code. The Doctor reads only local file metadata and command-line arguments. It has no shell, network, API client, secret access, telemetry, or write capabilities.

Only the existing canonical repository governance, tests, reviews, owner approvals, and independently verified provider state govern merging or launching changes. A draft PR is not a deployment. Updating the Doctor cannot itself register a Codex environment: that is a separately managed platform connection.

## Hardened change-path advisory (October 13, 2026)

The Doctor now conservatively marks changes to Hercules agent instructions, CI configuration, build manifests, verification scripts, runtime/model/authentication code, and hosting/provider infrastructure as **review_required**, not **isolated**. Added coverage includes `.agents/`, `.github/`, `scripts/`, `hercules-runtime/`, `hercules-models/`, `render/`, `infra/`, `shopify/` and other high-impact paths.

Its cross-platform path validation rejects ambiguous aliases before classification: drive-relative/alternate-data-stream colons, encoded octets, home-prefixed forms, Git internals, Windows reserved device filenames, trailing dots or spaces, and bidirectional control characters. Additional private-key formats are flagged for review without reading their contents.

This remains an **advisory with no authorization capability**. Ordinary documentation/test files remain eligible for an isolated classification; a review_required label calls for inspection, not automatic denial. The result does not grant merge authority or imply that Codex Cloud has been published. Three new regression tests cover the protected boundaries, hostile path spellings, and unchanged ordinary-file behavior.
