# Hercules Revenue Rescue v0.1

Revenue Rescue is the first customer-facing revenue recovery product built on Hercules.

## Product contract

The v0.1 flow is:

1. authenticated organization member ingests a recoverable lead;
2. Hercules normalizes the lead and creates only channel actions the lead is permitted to receive;
3. terminal signals (booked, won, lost, opt-out, human handoff) cancel queued automation;
4. lifecycle events are append-only;
5. the dashboard reports leads, wins, queued/failed actions, recovery rate, and recovered revenue.

The live API is the `hercules-revenue-rescue` Supabase Edge Function. Its tables are `hercules_revenue_leads`, `hercules_revenue_actions`, and `hercules_revenue_events`. All three use organization-scoped RLS through Hercules membership helpers.

## Deployment rule

Revenue Rescue must be carried by Hercules Deploy rather than treated as an untracked provider-side function.

The target kind is `supabase_edge_function`, with a target reference in the form:

`<project-ref>:<function-slug>`

The artifact bundle is stored in deployment metadata under `edgeFunction` and is SHA-256 fingerprinted before provider execution. The adapter captures the prior function snapshot, verifies the deployed function is active with the expected JWT policy and artifact fingerprint, and can restore the previous function on rollback.

Provider authorization remains outside the deployment request. No Supabase access token or provider secret is permitted in request metadata.

## Current provider mode

The production deployment capability remains `assistant_managed` until Hercules receives a scoped Supabase Management API credential with Edge Functions read/write permission. The connected assistant may execute the provider step while Hercules owns the source commit, request, fingerprint, verification evidence, and rollback evidence. Once a scoped credential is installed in the trusted deploy runtime, this same adapter can become `backend_autonomous` without changing the release format.
