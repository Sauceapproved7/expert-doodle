# Smallz Gateway Real HTTP and Chromium Verification

This source-only CI test spawns the **actual** `hercules-browser-gateway-v2/server.mjs` as a local process with a synthetic bearer token and an ephemeral loopback port. It installs the gateway's existing pinned Playwright dependency and real Chromium. No live Render gateway, Supabase credentials, or external target websites are used.

## Acceptance

- Unauthenticated and wrong-token `POST /v1/run` requests return 401.
- A bearer-authenticated request to a loopback/private address is blocked with 400.
- URLs embedding user credentials are blocked.
- Unsupported arbitrary-script actions are blocked.
- The real gateway starts Chromium, returns an `about:blank` navigation snapshot, reuses the browser session for a scrape, and closes it.
- The child process and browser are terminated after the test.

## Boundary

This validates the **real gateway HTTP service and Chromium**, unlike the isolated browser adapter test. It does **not** connect the live owner-app signed trace gate to the gateway over a network, validate production service-to-service authentication, verify production Supabase migrations, or authorize live deployment. Existing signed trace and PostgREST tests remain separate, required checks.

The test uses localhost and synthetic tokens only. No paid infrastructure or live services are changed.
