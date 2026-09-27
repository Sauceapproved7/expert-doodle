# Hercules DevBrain Browser Fabric Repair v0.1

Date: 2026-09-27 UTC

## Launch finding

A fresh launch-gate run failed the technical gate because the DevBrain fabric check was stale. Refreshing DevBrain exposed a real compatibility defect in the browser check.

The browser worker had already cut over from a direct Browserless endpoint to the owned Hercules Browser gateway:

- worker base URL: `https://hercules-browser-gateway.onrender.com`
- engine: `playwright-cdp-gateway`
- gateway health endpoint: `/health`
- legacy Browserless endpoint: `/json/version` returned HTTP 404

The DevBrain check still assumed a direct Browserless worker and called `/json/version?token=...`, causing a false browser failure after the gateway cutover.

## Repair

DevBrain now checks the browser layer through the owned `hercules-browser` control surface instead of reaching into the worker implementation directly.

The new probe:

1. retrieves the existing `browser-gateway` internal credential server-side;
2. calls the deployed `hercules-browser` Edge Function;
3. performs a safe scrape against `https://example.com/`;
4. requires an HTTP success, `ok: true`, and a returned browser result;
5. records only compact verification evidence such as trace ID, final URL, and title.

## Why this is stronger

The repaired check exercises the same production path used by Hercules workloads:

`DevBrain -> hercules-browser -> Hercules Browser Gateway -> browser worker`

This verifies the owned browser control surface instead of depending on a provider-specific health URL.

## Safety

- no raw code execution;
- no private-network target;
- no credential returned to the caller;
- no customer data;
- no browser state mutation beyond an isolated public-page probe;
- existing internal authorization remains required for the DevBrain POST check.

## Launch rule

After deployment, rerun the DevBrain fabric check and then rerun the launch gate. The technical gate should only return healthy when the live AI, browser, and WASM checks are current and passing.
