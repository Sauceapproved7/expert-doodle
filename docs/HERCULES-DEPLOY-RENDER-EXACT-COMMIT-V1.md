# Hercules Render exact-commit Smallz release planner (v1)

**Scope:** Pure, first-party, **read-only** preparation of a pinned exact-SHA Render API request. It does not deploy, read secrets, change Render settings or authorize payment, rollback or production cutover.

## Fixed release identity

- Render service `srv-db08fglg1s2s73d0o2rg`: `smallz-hercules`, existing free instance
- Existing live deployment ID `dep-db6psunf3r2c73c27ph0` at `ac4ebb822e421e4cc3a3b6bbea28330552304d95`
- Reviewed candidate SHA `861c8244ef1f86ec8843569e372d6f01abb8aec1` from [draft PR #1024](https://github.com/Sauceapproved7/expert-doodle/pull/1024), forked directly from the live commit
- Any change to provider identity, live deploy ID/SHA, service plan, branch, suspended state or reviewed candidate causes a **held** result with no API request
- **Render automatic deployment must already be disabled** (`autoDeploy=no`, `autoDeployTrigger=off`). Currently the actual service is `autoDeploy=yes`, `autoDeployTrigger=commit`, so a real read correctly produces `held` until the provider state is changed through separate owner-authorized means.

## Usage

```js
import {planSmallzExactCommitRelease, SMALLZ_RELEASE} from './hercules-deploy/render-exact-commit.mjs';
const plan = planSmallzExactCommitRelease({
  service: authorizedRenderServiceRead,
  liveDeployment: authorizedRenderActiveDeployRead,
  releaseCommit: SMALLZ_RELEASE.candidateSha,
});
```

The only possible request is a `POST` to Render's `/v1/services/srv-db08fglg1s2s73d0o2rg/deploys` with `{ "commitId": "<exact reviewed SHA>", "clearCache": "do_not_clear", "deployMode": "build_and_deploy" }`. This object is **not sent** by this module. Authorized API access, fresh provider observations, ownership/security reviews and independent after-deploy proof remain prerequisites.

See <https://api-docs.render.com/reference/create-deploy> and <https://render.com/docs/deploys>. Render API's exact-commit deployment **does not disable autodeploys**, so it is unsafe to run against the currently configured Smallz service without a separate reviewed state change.

## Testing

`node --test tests/hercules-deploy-render-exact-commit.test.mjs`

Eight synthetic regression tests verify exact commit/rollback identity, stable provider route, refusal of auto-deploy-on, wrong service or status, unexpected SHA, stale provider evidence and no secret/network side effects. No test calls Render. Existing Hercules Deploy Plane CI runs `tests/hercules-deploy*.test.mjs` and this module lives inside that boundary.

No new libraries, cloud services, subscriptions, provider permissions or credentials. The current live Smallz deployment is unaffected. The planner does not claim authenticated browser functionality, successful releases or available paid checkout.
