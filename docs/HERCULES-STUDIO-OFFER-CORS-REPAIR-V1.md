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

## Production-release boundary

**GitHub changes do not automatically repair live CORS.** The deployed Supabase `hercules-launch` function version 45 (observed October 15, 2026) differs from the repository main source. Deploying repository main *as-is* would include unreviewed changes unrelated to this narrow CORS fix. Before any production release:

1. Perform a source drift reconciliation against **all live deployed function files**, not just `index.ts`.
2. Get the required owner-authorized release gate, snapshot exact deployed function files and a rollback version, and verify no commercial, credential or account-policy mutation.
3. Deploy a precisely reviewed artifact through the authorized Supabase Edge Function path. Do not deploy by editing database tables or bypassing identity control.
4. Run real `OPTIONS` preflight requests, both allowed and denied origin/header probes, and benign failed-validation `POST` (no real lead). Verify status, CORS headers, no personal data, and unchanged sign-up/paid-claim protections.
5. Publish the **separate** approved Studio offer HTML only after both runtime and code checks pass; then repeat a real browser request and validate durable request delivery using a genuine or explicitly controlled eligible test, never a fabricated customer order.

There are two independent holds: CORS on the live Edge Function and the separately outdated Supabase Storage Studio offer. Neither GitHub PR completion nor a passing offline test proves either production fix has occurred.

## Provenance

Original SauceApproved/Hercules-owned, AI-assisted JS code and regression tests. Node.js built-ins and standard Web API classes only; no third-party packages, credentials, paid services or buyer submissions. Refer to [Studio publishing issue #1065](https://github.com/Sauceapproved7/expert-doodle/issues/1065).
