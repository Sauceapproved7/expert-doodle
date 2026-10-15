# Hercules Prompt Intelligence — durable replay store v1

Scope: **source-only**, staged migration; not installed into live Supabase.

## Design
`createDurableReplayClaim({rpc})` implements the existing `ingestBrowserTrace` replay callback without embedding credentials or granting browser-page instructions any tool authority. `rpc` is a trusted, authenticated service-role-only adapter supplied by the integration layer. It must return a bare boolean; unknown responses and transport failures fail closed.

The migration `20261015120000_hercules_prompt_trace_replay_v1.sql` creates an RLS-enabled, restricted counter table and a service-role-only atomic monotonic PostgreSQL RPC. A single SQL `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE last_sequence < EXCLUDED.last_sequence` provides concurrency-safe counter advancement. It does not require raw browser content, URLs, cookies or secrets to be stored. Anonymous and ordinary authenticated roles have no table or function privileges.

## Validation
`node --test tests/hercules-prompt-intelligence-*.test.mjs` includes replay, invalid identity, transport failure, and signature/trust-boundary tests. The repository workflow also runs owner-code and security gates.

**Known verification gap:** SQL migration has not been executed against a real isolated Postgres/Supabase environment, so database privilege, contention, transaction rollback and PostgREST response semantics need independent staging evidence before applying anywhere live.

## Staging integration
1. Apply migration to a *disposable* PostgreSQL environment with Supabase roles; confirm RLS, denied anon/authenticated access and service-role execute.
2. Use a server-side PostgREST/RPC client scoped to the service role; wrap `client.rpc('hercules_prompt_trace_claim_sequence', args)` to return only validated `data === true` or `data === false` and throw on errors.
3. Pass the callback into `ingestBrowserTrace` after successful HMAC verification; do not allow browser-origin content to choose key, source or RPC transport.
4. Exercise simultaneous requests, restart/replay, stale sequence, invalid source, expired credentials, network failure and transaction rollback.
5. Verify real Smallz exporter behavior in isolated staging before any production wiring.

## Recovery and rollback
No migration or external service has been changed through this PR. To abandon the change, revert the source, migration and test commits. If staged migration is installed, disable dependent ingestion first, then drop only the newly introduced function and table after inspecting evidence retention requirements. This is a security control: do not wipe production counter state to make repeated messages pass.

## Product completion boundary
This work is one module of the larger lab. Trusted Smallz exporter and key custody, actual browser E2E, Forge and Gatehouse adapters, independent database testing, staging deployment and provider-verified health are still outstanding.
