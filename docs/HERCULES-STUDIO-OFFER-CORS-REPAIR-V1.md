# Hercules Studio founding-access CORS repair

## Scope

The public Studio offer at `https://sauceapproved-forge-host.onrender.com/sauceapproved-studio-offer/` posts JSON to the existing `hercules-launch` Edge Function with action `software_access_request`.

The previously observed browser preflight returned HTTP 405 and no required CORS headers. The committed Edge Function had no `OPTIONS` handler and the software-access JSON responses omitted `Access-Control-Allow-Origin`.

This patch adds `studio-offer-cors.mjs`, imported and used by `supabase/functions/hercules-launch/index.ts`.

## Guardrails

- Accept browser preflight only for the **exact** origin `https://sauceapproved-forge-host.onrender.com`, method `POST`, and sole requested header `content-type`.
- Respond with HTTP 204 and `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: POST`, `Access-Control-Allow-Headers: content-type`, `Vary`, and `Cache-Control: no-store`.
- Reject other origins (including `null`), methods, and privileged headers. Never set wildcard origins or `Access-Control-Allow-Credentials`.
- Decorate **only** the `software_access_request` action's normal and error JSON replies for this trusted origin. CORS is not authentication; the existing database request rate checks and service-role-only RPC must remain unchanged.
- Existing unrelated `hercules-launch` routes (account sign-up, privacy, piloting, Studio paid claims, Titan, Sound World, storefront redirects, billing, registration) are out of scope.

## Test

Run `node --test tests/hercules-launch-studio-offer-cors.test.mjs` (Node 22). The existing `hercules-studio-commerce.yml` CI workflow also runs these tests on PR changes.

## Live targeted hotfix evidence — October 15, 2026

After the 24/24 PR-head checks passed, the authorized Supabase Edge Function deployment interface updated the existing **`hercules-launch`** function from version **45** to **46** using the exact current live sources as the starting point. The replacement changed only the deployed `index.ts` wiring and added `studio-offer-cors.mjs`; `pilot-admission.ts`, `studio-access.ts`, `titan-access.ts`, and `soundworld-gift-access.ts` were carried forward byte-for-byte from v45 instead of being replaced by divergent GitHub main files.

- Previous provider bundle SHA-256: `b56b3e0a355b0056d46efc1eb0391c1a3303b7052a08e163c9d3de2bfe24a61f`.
- New provider bundle SHA-256: `467f4f0276cfb51ec8302630e8d4d79268313bb3fc152312e55de7da89dd66e8`.
- Provider reports v46 `ACTIVE`, preserving `verify_jwt=false` (existing public function setting), with the CORS helper and only two wrapped `software_access_request` response paths confirmed present.
- The exact patch was validated by reversing all four textual replacements and comparing it to the previous v45 entrypoint before deploying.
- **This does not publish** the still-stale founding-access offer HTML or open paid subscriptions, signup, customer entitlements, or payment processing.

A live OPTIONS preflight check and subsequent no-lead error response probe are required before claiming the browser form transport works. The source drift precautions below still apply to **future** deployments from GitHub main; do not overwrite this v46 hotfix with unreviewed main code.

## Production-release boundary

**GitHub changes do not automatically repair future live CORS changes.** The previous deployed Supabase `hercules-launch` function version 45 differed from repository main; the v46 hotfix deliberately preserved the live v45 modules and inserted only the reviewed CORS change. Deploying repository main *as-is* would include unreviewed changes unrelated to this narrow fix. Before any further production release:

1. Perform a source drift reconciliation against **all live deployed function files**, not just `index.ts`.
2. Get the required owner-authorized release gate, snapshot exact deployed function files and a rollback version, and verify no commercial, credential or account-policy mutation.
3. Deploy a precisely reviewed artifact through the authorized Supabase Edge Function path. Do not deploy by editing database tables or bypassing identity control.
4. Run real `OPTIONS` preflight requests, both allowed and denied origin/header probes, and benign failed-validation `POST` (no real lead). Verify status, CORS headers, no personal data, and unchanged sign-up/paid-claim protections.
5. Publish the **separate** approved Studio offer HTML only after both runtime and code checks pass; then repeat a real browser request and validate durable request delivery using a genuine or explicitly controlled eligible test, never a fabricated customer order.

There are two independent release checks: actual browser-compatible CORS behavior at the updated live Edge Function, and the separately outdated Supabase Storage Studio offer. Neither GitHub PR completion nor a passing offline test proves the customer submission flow is working.

## Provenance

Original SauceApproved/Hercules-owned, AI-assisted JS code and regression tests. Node.js built-ins and standard Web API classes only; no third-party packages, credentials, paid services or buyer submissions. Refer to [Studio publishing issue #1065](https://github.com/Sauceapproved7/expert-doodle/issues/1065).
