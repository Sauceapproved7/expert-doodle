# Hercules Smallz server-side read-only readiness runner v1

## Purpose

`hercules-deploy/smallz-readiness-runner.mjs` provides a narrow **server-side** entry point over the existing Smallz GitHub/Render pinned GET readers and read-only evidence bridge. It does not run on a public web route or in the Smallz browser.

This module runs with an explicit server-side opt-in only. Its output is a sanitized, advisory HOLD or CONSISTENT_UNATTESTED report, **never** a deployment or release authorization.

## Operating prerequisites

- An already authorized, isolated server process with Node 22 and existing repository checkout.
- Explicit environment flag `HERCULES_SMALLZ_EVIDENCE_READ_ENABLED=true`.
- Separate server-only read credentials under `HERCULES_SMALLZ_RENDER_READ_TOKEN` and `HERCULES_SMALLZ_GITHUB_READ_TOKEN`, provisioned by the legitimate credential owner through the provider's approved custody. The implementation **does not create, fetch, read, or grant** these credentials in this change.
- For the explicit opt-in server operator only: `node hercules-deploy/smallz-readiness-runner.mjs --read-only`. Without the exact switch the CLI makes zero provider requests, returns HOLD and exits 2.
- The runner refuses credential collisions with detected existing deployment-control/admin tokens instead of silently reusing them. Credential shape and name do **not** prove read-only provider scopes: independently constrain provider tokens to required GET reads.

## Authority and privacy

- On missing opt-in or dedicated credentials, return HOLD before network access.
- When authorized for reads, use only three pinned HTTPS GET endpoints via `smallz-provider-readers.mjs`, with bounded JSON response parsing, manual-redirect prohibition, 4-second timeout and 64 KiB response limit.
- The runner never contacts the owner-only runtime identity route, so its output continues to state `OWNER_RUNTIME_UNVERIFIED` until a separately authorized owner-authenticated tool is available.
- All returned fields are whitelisted: normalized commit and deployment IDs, reason codes, and explicit negative approval/authentication/production-effect flags. No token, header, raw JSON, stack trace, arbitrary input action, provider error text or secret is emitted.
- The process exit code is 2 for HOLD, and 0 only for `CONSISTENT_UNATTESTED`. Exit 0 must never be confused with release approval or an attested production state; independent provider authentication is **not** established merely by injection of reader functions in tests.
- No deploy, rollback, write call, auto-deploy toggle, billing, customer checkout, DNS change or staging-to-production transfer.

## Verification

`node --test tests/hercules-deploy-smallz-readiness-runner.test.mjs`

`node --test tests/hercules-deploy*.test.mjs`

`node scripts/verify-hercules-execution-contract.mjs`

The tests were committed first and failed as expected (missing module, 120 pre-existing tests passed). After implementation an inaccurate test substring check was corrected without weakening leak prevention; GitHub Deploy Plane job `115609679783` reported **128/128 tests passed, 0 failed** at `e33c182b8d46b94e610a6dcd1d4b94853db85528`. Verify final CI on the complete documented commit separately.

## Production boundary

Smallz Render remains on an older known live commit. The linked service's `autoDeploy=yes` / `autoDeployTrigger=commit` keeps the release-path safety issue open. Keep this change in a draft PR until the service's exact-commit deployment and connection implications are reconciled. This is new code in the repository, not evidence that the GET-only runner has been invoked on a live, authorized host.
