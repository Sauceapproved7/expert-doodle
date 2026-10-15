# Smallz Prompt Intelligence — Isolated Staging Contract

## Scope

This change verifies the **actual application code path** from an authenticated owner request through Smallz browser-intent signing, fixed Supabase RPC sequence reservation, HMAC verification, durable replay-claim adapter and bridge dispatch. It also verifies anonymous rejection, altered signatures, duplicate replay, database unavailability and default-off compatibility.

The Node test uses synthetic owner identity, synthetic service-role key, and an in-memory **PostgREST response simulator**. It does not connect to live Supabase, issue a real browser navigation, or deploy a Render service. The separate `replay-postgres` CI job tests real disposable PostgreSQL migrations, atomic claims, concurrent workers, and privilege checks. Passing both jobs is stronger source evidence, **not production end-to-end proof**.

## Rollout preconditions

1. Verify the canonical Smallz service's current deployed commit; source merge alone is not deployment.
2. Obtain an authorized isolated staging database or an existing disposable Postgres with the two migrations installed; no production schema changes.
3. Configure server-only trace keys on staging, never in browser HTML, logs, or tests.
4. Validate authenticated Smallz browser actions and expected negative cases with a real browser; check database receipt ordering under multiple workers.
5. Recheck readiness gate, cost, and rollback before enabling `HERCULES_PROMPT_TRACE_ENFORCE_BROWSER=true` on any live service.

**Important unresolved concurrency limitation:** the current replay claim uses a monotonically increasing last-sequence counter. Different Smallz instances can reserve sequences in order and submit them out of order, rejecting the earlier event. Keep production enforcement off until cross-instance ordering is tested or this architecture is revised. A rejected trace blocks browser dispatch by design.

## Recovery

Leave enforcement disabled. No database migrations, credentials, live Render settings, or owner account data are changed by this PR. Revert the test-only commit if necessary. Do not report this as a real staging or production deployment.
