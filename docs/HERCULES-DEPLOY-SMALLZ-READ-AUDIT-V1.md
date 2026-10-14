# Hercules Smallz Server-Side Read Audit v1

## Scope

Original first-party SauceApproved read-only audit orchestrator: `hercules-deploy/smallz-read-audit.mjs`, one-shot operator entrypoint `scripts/hercules-smallz-read-audit.mjs`, and tests `tests/hercules-deploy-smallz-read-audit.test.mjs`. This reuses the existing Smallz fixed-destination GitHub/Render REST readers and release evidence bridge. It is **not** a deployment adapter, signed attestation, browser health check, billing gateway, secret-retrieval service or release approval.

## Custody and least privilege

An authorized existing server process must provision **separate** secret environment entries:

- `HERCULES_SMALLZ_READ_AUDIT_ENABLED=true` (must match exactly)
- `HERCULES_SMALLZ_RENDER_READ_TOKEN`
- `HERCULES_SMALLZ_GITHUB_READ_TOKEN`

The audit refuses missing/malformed credentials, identical GitHub/Render read values, or a read value equal to known deployment/control credentials such as `HERCULES_RENDER_API_TOKEN`, `HERCULES_DEPLOY_CONTROL_TOKEN`, `RENDER_API_KEY`, `GITHUB_TOKEN`, `GH_TOKEN`, or `SUPABASE_SERVICE_ROLE_KEY`.

**Security limitation:** Merely using separately named credentials does **not prove** that provider-granted token scopes are read-only. The owner must verify provider-side scopes, token lifetime and existing authorized custody. Do **not** mint tokens or insert private values into chats, GitHub source, CI logs, URL parameters, browser storage or example commands. The code never retrieves secrets from Supabase Vault, reads existing provider credentials or opens a public endpoint.

## Running only within an already authorized server process

    node scripts/hercules-smallz-read-audit.mjs

With no exact opt-in the CLI returns JSON `DISABLED` and performs zero requests. Exact opt-in with missing credentials returns JSON `HOLD` and exits with status 2, without network access. Exact opt-in with valid *distinct* credentials uses only three pinned GETs: GitHub main ref, Render Smallz service, and latest Render Smallz deployment. Provider failures are reported by bounded reason codes without echoing secrets or errors. A healthy read-only response may still return `HOLD` because Smallz's auto-deploy is on, live commit does not match GitHub main, and an independently authorized owner-runtime read remains absent. That HOLD is **not proof of production outage**.

This audit never requests or executes `POST`, `PATCH`, `DELETE`, deploy, rollback, billing, DNS, payment or policy changes. It does not auto-schedule itself. It does not attach to the privileged existing Deploy Plane worker or expose an HTTP route.

## Tests and proof

    node --test tests/hercules-deploy-smallz-read-audit.test.mjs
    node --test tests/hercules-deploy*.test.mjs
    node scripts/verify-hercules-execution-contract.mjs
    node scripts/verify-owner-code-only.mjs

Tests were written before implementation. First RED commit `ebd59e84187bd1a3e8f836d435359f221b84464b` failed because the new module did not exist (112 original Deploy Plane tests passed). GREEN orchestrator commit `eeea1fad3fc87635c9ee03b6decbeb5479aaae68` passed 119/119 tests. An additional RED entrypoint test at `3c99c87a25ddca97b2e2f63d7fe484ccd03d4cde` failed because the script was absent (119 prior tests passed); GREEN command commit `b7c2060f071bc5a5746b3e215cdcca1b9a29f8d0` passed 120/120 tests, zero failures.

This PR is intentionally draft/unmerged until all exact-head CI results are recorded and the Smallz release plan in issue #1021 is reconciled. Provider credentials, a real production audit invocation, paid hosting and a Smallz runtime identity are **not verified or configured by these commits**.

## Two-pass provider-state race protection (v1.1)

The opt-in audit now takes **two sequential, identical sets** of its pinned, GET-only GitHub main/Render service/Render deployment reads (six GETs total). Each result is normalized and compared as a complete bounded record. If the provider main commit, live deployment, service settings, evidence classifications, or any other normalized field changes between rounds, the command returns a **HOLD** with reason `PROVIDER_STATE_CHANGED_DURING_READ`, `snapshotStability=changed`, and no selected release identity. Repeated malformed or incomplete evidence is `snapshotStability=unverified`; matched complete records are `snapshotStability=stable` but are never automatically approved.

Two consistent observations **do not** independently authenticate the provider, prevent changes after the second read, establish a distributed transaction or authorize a deployment. This is a bounded race detector only; correlated false evidence remains possible and owner-runtime identity must still be separately verified. The original explicit opt-in, distinct server-held credential checks and refusal to reuse deployment tokens remain active.

Regression tests were added before the implementation: the red test-only head `537a0b0941b9f77a3f22f3b4c75c12817fa2defe` failed four new scenarios (120 prior tests passed); the implementation head `ee7d0ecf81b83ef042c085812471c70fa30bacbc` passed **124/124** Deploy Plane tests. Final CI security and provenance results must be confirmed on the exact final commit. No credentials, deploys, paid infrastructure, environment settings or production services changed.
