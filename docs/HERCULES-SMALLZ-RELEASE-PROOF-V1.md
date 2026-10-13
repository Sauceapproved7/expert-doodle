# Hercules Smallz Release Proof v1 — owner-only provider / runtime binding

**Scope:** Read-only cross-checking of Smallz's Render deployment identity, canonical GitHub main SHA, and an owner-authenticated runtime identity. No changes to Render services, DNS, Shopify, payment, production release gates or Codex Cloud accounts.

## Two distinct identity sources

1. **Render's authenticated provider record:** obtain the exact owned `smallz-hercules` service `srv-db08fglg1s2s73d0o2rg`, plus its actual active deployment status and full commit SHA using a legitimately connected Render read-only API/tool. Independently read canonical GitHub `main` commit. `assessSmallzReleaseEvidence` detects service/repository mismatches and labels SHA alignment as `matches_main`, `different_from_main` or `unverified`. Caller-supplied JSON cannot be authenticated by this offline comparison function.

2. **Smallz running process:** a future deploy of the new source provides GET `/api/runtime/identity` only after the existing owner authentication and external Abyss-control-state read both succeed. It returns strictly validated built-in Render metadata (`RENDER_SERVICE_ID`, `RENDER_GIT_REPO_SLUG`, `RENDER_GIT_BRANCH`, `RENDER_GIT_COMMIT` and `IS_PULL_REQUEST`) and nothing from sessions, payments, passwords or the external control state. Render documents these automatic environment variables: https://render.com/docs/environment-variables.

`probeSmallzOwnerIdentity` requests only `https://smallz-hercules.onrender.com/api/runtime/identity`, with an authorization value supplied privately by the already-authorized caller. It does not fetch without that value; does not follow redirects; has a 4-second timeout and a 4-KiB response limit; sanitizes errors; returns no supplied authorization value.

## Test and review

```sh
node --test tests/hercules-smallz-release-proof.test.mjs tests/hercules-smallz-runtime-identity-route.test.mjs
node scripts/hercules-preflight.mjs
```

The mocked tests require neither Render nor actual owner credentials; they do not establish live owner authentication. All code remains inert until the owned Smallz runtime is deployed separately through existing release approvals.

## Verification ladder (do not collapse steps)

- **Provider record consistent:** Render reports a live deployment tied to the exact Smallz service and repo. A status of live alone does not prove an authenticated customer or a working browser.
- **Git SHA alignment:** the Render deploy SHA either equals or differs from canonical GitHub `main`. A prior commit may legitimately be live; divergence is not itself an outage.
- **Authenticated owner identity read:** once deployed, the protected runtime route can confirm the running process's reported commit matches the provider's active commit.
- **Functional customer behavior:** still *unverified* without independent authenticated navigation/functional tests. A successful owner control-plane read is not end-to-end browser functionality.
- **Commerce and public release:** never authorized by this tool. Fields `productionHealthVerified`, `paymentFlowVerified`, `releaseApproved` remain false.

**Differentiators:** provider-to-process commit identity alignment; security-boundary reuse with read-only, credential-free outputs and hard evidence levels. No broad health or release claim without downstream evidence.

Owner-only action and provider authorization are not bypassed. No new secrets, dependencies, license obligations or paid infrastructure.
