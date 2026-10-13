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

## First-party server-side authenticated REST transport

Use createSmallzProviderReaders({renderApiToken,githubApiToken}) from hercules-deploy/smallz-provider-readers.mjs in an authorized server-only process, then pass the returned three read functions into collectSmallzEvidence. Obtain both credentials from already-authorized server-side custody; neither is fetched, provisioned, stored in this repo, logged, or returned by the readers.

The transport permits only these three GET requests:

- https://api.github.com/repos/Sauceapproved7/expert-doodle/git/ref/heads/main
- https://api.render.com/v1/services/srv-db08fglg1s2s73d0o2rg
- https://api.render.com/v1/services/srv-db08fglg1s2s73d0o2rg/deploys?limit=1

It requires bearer credentials for both APIs and pins arguments, methods, destination hosts, no-redirect behavior, a 4-second timeout and a 64 KiB streaming response maximum. The client accepts JSON 200 replies only, strips nonessential service/build attributes and transforms Render REST's list shape with deploy and cursor properties to the existing bridge's normalized deployment array. It never returns its credentials or the provider's full raw result.

Example (a server process with legitimate existing credential access only):

    import {createSmallzProviderReaders} from './hercules-deploy/smallz-provider-readers.mjs';
    import {collectSmallzEvidence} from './hercules-deploy/smallz-evidence-bridge.mjs';
    const readers=createSmallzProviderReaders({
      renderApiToken: authorizedServerRenderToken,
      githubApiToken: authorizedServerGithubToken,
    });
    const evidence=await collectSmallzEvidence(readers);

The snippet does not create, request or expose tokens and does not grant owner authorization. With default HTTPS fetch, the intended data source is the named provider API; an injected test fetch is NOT authenticated evidence. Even successful live GETs cannot prove that a running process is healthy or that the browser works. The existing bridge intentionally keeps providerRecordsIndependentlyAuthenticated=false and releaseApproved=false.

Authoritative API formats: https://api-docs.render.com/reference/retrieve-service and https://api-docs.render.com/reference/list-deploys.

Test-first RED: commit 6c29d4df07f3308d550bb7101f09c7b15e9bf532 failed due to missing module while 105 existing Deploy Plane tests passed. Implementation GREEN: c5224c424fa187ef4dc119a3ff93b27d1bd744b0 passed 112/112 Deploy Plane tests. Final exact-head checks must be separately verified.

No existing live service, provider integration, secret store, DNS, revenue path, customer data, payment system or billing plan was changed.
