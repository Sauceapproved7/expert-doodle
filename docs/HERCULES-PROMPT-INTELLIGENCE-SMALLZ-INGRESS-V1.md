# Hercules Prompt Intelligence — Smallz authenticated trace ingress (v1)

## Outcome
An **opt-in, owner-authenticated, server-side-only** Smallz API can verify a signed trace event, atomically claim its replay counter using the existing Hercules Supabase RPC, and return a minimal receipt. This is a **source-level integration**. No live Render/Supabase change or browser-session capture is authorized by this pull request.

## Integration path

`POST /api/prompt-intelligence/trace` -> existing Smallz `authenticateOwner` -> fixed Smallz HMAC signing-key lookup -> `ingestBrowserTrace` -> fixed project HTTPS PostgREST `hercules_prompt_trace_claim_sequence` -> metadata-only receipt.

Example receipt contains only `{accepted,source,sequence,digest,kind}` and, for tool attempts, `allowed:false`. It never includes raw website URL, page text, browser cookies, form values, sign key, private API key or raw RPC error.

This endpoint is **not** a source of authority for browser navigation, deployment, approvals, payments, account changes or credentials. Any `tool_attempt` event always remains denied. Browser content and RPC results are data, never an instruction to execute actions.

## Enablement

Nothing is enabled unless **all three server-only** variables exist and validate:

- `HERCULES_PROMPT_TRACE_PROJECT_URL`: an HTTPS origin for an explicitly selected Supabase project (no credentials, path, query, fragment or arbitrary host).
- `HERCULES_PROMPT_TRACE_SERVER_KEY`: existing secret server-side Supabase key with permission for the service-role-only replay RPC.
- `HERCULES_PROMPT_TRACE_HMAC_KEY_B64`: random 32-or-more-byte signing secret encoded in standard Base64, held entirely on the server.

None of these settings belongs in frontend HTML, browser storage, a client bundle, a pull request, or a log. The key should be distinct from payment, browser-control and other application secrets.

With missing or invalid configuration, the endpoint remains fail-closed and responds only to authenticated owner requests with HTTP 503. An invalid signature or malformed envelope is rejected before RPC. Duplicate sequence claims are rejected; RPC transport errors and ambiguous responses also fail closed.

Legacy service-role JWT requests use Authorization plus apikey. New secret keys use apikey only. The destination is fixed at the validated project host and a fixed RPC path; redirects are prohibited.

## Evidence and test contract

Tests are in `tests/hercules-prompt-intelligence-smallz-ingress.test.mjs`, plus existing browser/Smallz security regressions. They cover:
- missing credentials/default-deny; owner authentication; no unauthenticated RPC;
- wrong sender/MAC; replay rejection; invalid input and destination;
- HTTP errors, redirect/network errors and unexpected RPC response shapes;
- no reflection of page text, URL, provider errors or credentials;
- denied tool-attempt receipts.

This source change makes no assertion that a real browser exported traces or that the service-role key and migration are installed in any target environment.

## Rollout / rollback

1. Review and merge source only after **exact-head** CI, CodeQL, ownership/provenance and canonical Boil the Ocean checks pass.
2. In separately authorized isolated staging, apply the replay migration, configure a distinct server key and signing key, verify the configured role and PostgREST boolean response on real infrastructure.
3. Connect a trustworthy Smallz exporter with a server-owned replay sequence allocator and cryptographic custody; do not give page scripts signing or DB authority.
4. Run genuine Smallz browser end-to-end security tests, including duplicate, tamper, prompt injection, malformed URL and failed upstream cases.
5. Promote only after staging succeeds, release/rollback evidence is collected, and all existing owner and provider security controls are intact.

Rollback source by reverting this PR. For any future staged installation, disable trace ingestion first. Do not drop persistent replay state just to accept old events.

## Open system-wide work
Trustworthy Smallz *emission*, approved sequence assignment, real auth/session flows, Forge/Gatehouse connectors, isolated staging deployment and independent runtime verification are **not** established by this source-only change. It must never be marked production complete on local or mocked success alone.
