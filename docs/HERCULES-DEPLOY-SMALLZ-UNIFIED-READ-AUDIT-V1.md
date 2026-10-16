# Smallz unified read-only assurance — v1

**Purpose:** Unify two overlapping first-party Smallz release-audit drafts into one advisory, read-only path.

## Design

- One implementation of server-side credential custody and two-pass audit: `hercules-deploy/smallz-read-audit.mjs`.
- Existing one-shot command: `scripts/hercules-smallz-read-audit.mjs`, enabled only by `HERCULES_SMALLZ_READ_AUDIT_ENABLED=true`.
- Protected readiness CLI: `hercules-deploy/smallz-readiness-runner.mjs --read-only` requires BOTH `HERCULES_SMALLZ_EVIDENCE_READ_ENABLED=true` and `HERCULES_SMALLZ_READ_AUDIT_ENABLED=true`. Missing either prevents network activity.
- Both read paths use dedicated GitHub and Render read-token slots, reject collisions with known deploy/control token values, and never fall back to privileged write credentials. Real provider-side scopes must be verified by the authorized owner.
- The audit performs **two sequential rounds**, each containing three exact, pinned GET requests to GitHub's main ref, Render's Smallz service and Render's latest deployment. The transport does not accept arbitrary destinations or HTTP methods.
- It compares normalized evidence objects and HOLDS if the GitHub head, Render live version or other evidence differs across rounds. Two identical provider errors do not count as stable evidence.
- A pair of successful reads is **not** an atomic snapshot, a cryptographic signature, provider identity attestation, owner login, release authorization, runtime browser test, or proof that the deployed application is healthy.
- The readiness runner delegates directly to the audited two-pass implementation. It does not reimplement token custody or snapshot logic and it never adds a network endpoint or job.

## Fail-closed status

- Disabled if not explicitly opted in.
- HOLD if dedicated credentials unavailable or reused with privileged tokens.
- HOLD when any provider read fails or evidence changes during inspection.
- HOLD for current Smallz main/live SHA drift and enabled Render auto-deployment.
- Always executionAuthority=false, releaseApproved=false, ownerAuthorizationVerified=false and productionChanged=false.

## Validation

- RED combined head `5b62c7b7d3a15e355de48ab63bf72917c51292df`: **134 tests passed, 2 new integration tests failed**, proving the former readiness runner used a single read and ignored the audit opt-in.
- GREEN head `192a306d74a6e804b35c0310ef7c2e143755998a`: **136/136** Deploy Plane tests passed, with no failures.
- Existing `node --test tests/hercules-deploy*.test.mjs` remains the repository CI gate, plus owner-code, provenance, baseline security and CodeQL.

## Production and rollback boundary

This change only adds code on a review branch. The Smallz Render free service still reports autoDeploy=yes and the pre-existing live commit. No Render settings, deployments, release approval, code signing, secret custody, billing, checkout or customer records were changed. Do not merge until issue #1021 reconciles the controlled Smallz release path and the risk of a latest-main automatic deployment.

No extra dependencies, paid hosting services, new cloud services or browser-control privileges.
