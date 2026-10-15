# Smallz trusted trace emitter — source-only

The Smallz server can optionally audit authenticated browser navigation and scraping requests before dispatch. The emitter signs a fixed action label only, never a URL, page text, cookies, tokens or request body. It reserves a monotonic source sequence in a restricted Supabase PostgreSQL function, signs the envelope using HMAC-SHA256 and requires a verified replay-claim receipt before the browser bridge is invoked.

## Safety
Default disabled. Set `HERCULES_PROMPT_TRACE_ENFORCE_BROWSER=true` and all three existing server-only `HERCULES_PROMPT_TRACE_*` variables only in an isolated staging environment with the approved migration installed. No client page or arbitrary browser script gets signing or service-role credentials. An audit failure returns 503 and blocks the browser action. Existing browser behavior is unchanged while disabled. The emitter is an audit prerequisite, **not** authorization to browse, deploy, approve or pay; existing owner authentication and bridge controls remain independent.

The migration `20261015160000_hercules_prompt_trace_emit_sequence_v1.sql` creates a restricted counter table and a `service_role`-only, transactional, source-isolated sequence allocator. The counter increments are atomic and refuse invalid sources or JavaScript-unsafe overflow. Replays are rejected by the prior claim RPC. Both migrations are **unapplied to live Supabase**.

## Test and rollout
Run the trace workflow with Node regression tests and disposable PostgreSQL, including concurrent allocation, privileges and transaction rollback. The source must pass CodeQL, security baseline, owner-code provenance, and completion enforcement before merging. Validate a real owner-authenticated browser request and negative cases in isolated staging before any live enablement. Revert the source PR or disable `HERCULES_PROMPT_TRACE_ENFORCE_BROWSER` to roll back; retain replay counters to prevent reuse.

No real browser session, production deployment, live migration or credential change is part of this source-only PR.