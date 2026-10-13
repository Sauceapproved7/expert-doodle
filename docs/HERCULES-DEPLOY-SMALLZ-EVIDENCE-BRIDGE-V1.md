# Smallz read-only provider evidence bridge v1

This first-party Hercules Deploy Plane module consumes **pinned and bounded** GitHub and Render read-only connector output formats. It is evidence normalization, **not** independent provider authentication, a signed release attestation, a production health check, or deployment authority.

## Usage (read-only providers already connected by an authorized caller)

```js
import {collectSmallzEvidence} from './hercules-deploy/smallz-evidence-bridge.mjs';
const evidence=await collectSmallzEvidence({
  githubRead: async ({url}) => authorizedGitHubConnectorFetch({url}),
  renderServiceRead: async ({workspaceId,serviceId}) => authorizedRenderGetService({workspaceId,serviceId}),
  renderDeployRead: async ({workspaceId,serviceId,limit}) => authorizedRenderListDeploys({workspaceId,serviceId,limit}),
  // Only add if a separately authorized, owner-authenticated runtime read is genuinely available:
  // ownerIdentityRead: async () => authorizedOwnerRuntimeIdentityRead()
});
```

The caller must map these adapters to its own legitimately authenticated connections; this module does not provide such a connection and cannot authenticate a caller-supplied function. The pinned requests are:

- GitHub ref `https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main`
- Render workspace `tea-dalo7he5vjqs7383n2o0`, service `srv-db08fglg1s2s73d0o2rg`, latest deployment limit `1`
- Optional owner-authenticated runtime identity must match `sauceapproved.hercules.smallz-runtime-identity.v1` and the provider's running SHA

The collector recognizes the actual connector response envelopes: GitHub `result.content` with ref and 40-character SHA; Render `text` JSON with optional pagination cursor. Payloads are bounded to 64 KiB and malformed/error/secret-containing raw input is suppressed. Only normalized, allowlisted metadata is included in output.

## Fail-closed conditions

- A missing/errored reader, malformed response, spoofed service or invalid live deployment.
- Render auto-deploy enabled. This is a release-control hold, not a claim the currently running service is unhealthy.
- Provider deployed SHA differs from GitHub main. This indicates **release drift**, not necessarily an outage: Smallz may be running a valid older revision.
- Owner-only runtime identity absent, forged, incorrectly shaped, or different from the provider SHA.

Agreement can produce only `CONSISTENT_UNATTESTED` with `providerRecordsIndependentlyAuthenticated=false` and `recordFreshnessIndependentlyVerified=false`. The bridge cannot vouch for the authenticity of injected readers, a caller-supplied status, the CodeQL check, a trusted builder or actual browser navigation.

All outputs set `executionAuthority=false`, `releaseApproved=false`, `ownerAuthorizationVerified=false`, `productionChanged=false` and `runtimeHealthVerified=false`. No provider API mutation, secret access, billing change or new hosting is involved.

## Tests

`node --test tests/hercules-deploy-smallz-evidence-bridge.test.mjs`

Full repository Deploy Plane workflow runs `node --test tests/hercules-deploy*.test.mjs` with GitHub Actions. The new test first failed with `ERR_MODULE_NOT_FOUND`, then passed after adding the implementation; the Deploy Plane suite reached **105/105** at the implementation commit. Review final CI on the exact documented head separately.

## Production state

The last read from connected Render reports Smallz `autoDeploy=yes`, `autoDeployTrigger=commit`, and a live deployment `ac4ebb822e421e4cc3a3b6bbea28330552304d95` while GitHub main is newer. The collector correctly HOLDs this drift and does not attempt to change Render's settings. For the authorized exact-SHA deployment gate see issue #1021.
