# Smallz Signed Trace — Actual Chromium E2E in Disposable CI

This isolated GitHub Actions job installs the existing Smallz gateway's pinned `playwright-core@1.63.0` dependency and an ephemeral Chromium executable. It exercises the real `createHerculesBotApp` owner browser route, signed trace emitter and HMAC validation before launching actual headless Chromium.

The fixture is a self-contained `data:` HTML document; no live website, external user content, production browser, cookies, or credentials are read. It includes a prompt-injection attempt in page text to verify that the untrusted content is **never copied into the signed authorization trace**.

## Acceptance
- Unauthenticated owner request returns 401 before browser launch.
- Authorized request signs and verifies trace admission, then launches real Chromium and extracts fixture title/text.
- Browser fixture injection text, request URL and owner token do not appear in signed envelopes.
- A denied/unavailable trace claim returns 503 and prevents browser launch.
- Existing prompt-trace and PostgreSQL integration checks remain required.

## Boundaries
The browser launch and DOM read are real, but the `browserBridge` dependency is an isolated adapter and the claim callback is synthetic. This is **not** a production Smallz gateway SSRF/Chromium integration, real Supabase PostgREST call, or live owner account test. Real PostgREST HTTP was independently verified by PR #1092. Do not describe this test as full production E2E.

No deployment, live database migration, Render environment modification, paid hosting, or credential access is in scope.
