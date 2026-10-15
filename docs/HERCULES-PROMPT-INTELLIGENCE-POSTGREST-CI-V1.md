# Smallz Real PostgREST Integration (Disposable CI)

This source-only test connects the real Smallz trace ingress/emitter and owner browser-admission code to **real PostgREST HTTP endpoints** backed by a disposable PostgreSQL 16 CI service. The test uses a digest-pinned official PostgREST container and synthetic JWTs; it does not read any live Supabase keys or change Render.

## Tested contracts

1. Service-role JWT can reserve and claim sequences through real PostgREST HTTP.
2. Replaying the same sequence is denied, and a previously unseen lower sequence inside the bounded window is accepted.
3. Anonymous and authenticated roles cannot reserve or claim trace sequences.
4. An authenticated owner request signs a metadata-only browser event, verifies its HMAC, durably claims its sequence through PostgREST, then dispatches to a **synthetic** browser bridge.
5. Anonymous owner requests do not dispatch. Invalid browser actions do not dispatch.

The test deliberately injects a network adapter that maps the fixed validated Supabase hostname to localhost PostgREST; this does **not** validate real Supabase's gateway/API-key headers. The browser bridge is synthetic, so this is **not real Chromium/browser E2E**. All secrets are synthetic test-only values and the database is discarded after CI.

## Release limitations and next gates

- Live Smallz Render deployment still runs an older commit until independently updated and verified.
- The live Supabase project has not had the prompt trace migrations installed.
- There is no authorized no-cost separate Supabase staging project; do not create paid infrastructure without cost confirmation.
- Validate real Smallz Chromium, service-role PostgREST gateway behavior, live migration privileges, multi-worker load, and rollback in authorized isolated staging before enabling trace enforcement.

No production deployments, database writes, browser requests, billing changes or credential reads are part of this PR.

## Recovery

Discard CI containers on failure. Keep `HERCULES_PROMPT_TRACE_ENFORCE_BROWSER=false` in production. Never promote source-only CI evidence to production-ready status.
