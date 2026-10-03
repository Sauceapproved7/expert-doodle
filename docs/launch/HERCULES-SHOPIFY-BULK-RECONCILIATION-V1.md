# Hercules Shopify bulk order reconciliation v1

This feature is an on-demand correctness path for the canonical SauceApproved Shopify store. It snapshots a bounded order window into local integration state. It does not create fulfillments, refunds, inventory adjustments, or paid-order entitlements.

## Scope and safety

- The owner/admin `start_orders` action starts one initial backfill or incremental export for an organization with an active Shopify connection.
- The first run and subsequent runs cover at most the last 60 days, with a 30-minute overlap before the prior successful watermark. This avoids silently claiming a full historical order export.
- Exported fields are limited to the order GID, update time, financial and fulfillment statuses, cancellation time, and test flag. Customer, address, and line-item data are not retained.
- Shopify's `BULK_OPERATIONS_FINISH` subscription is checked/created before the bulk query is launched.
- Completion deliveries are verified against the raw body HMAC and deduplicated by delivery ID. The worker fetches operation metadata from Shopify, streams JSONL, validates the root object count, and commits state plus watermark only on full success.
- A failed or interrupted run leaves the watermark unchanged. An owner/admin can use `resume` with the run ID.
- State tables and RPCs are service-role only. Corrections only update this reconciliation snapshot; they do not invoke the paid-order or commerce-effect pipeline.

## Deploy and operate

1. Review and merge this branch, then apply the two migrations and deploy `hercules-shopify-bulk-reconciliation`.
2. Deploy this edge function with Supabase JWT gateway verification disabled (for example, `supabase functions deploy hercules-shopify-bulk-reconciliation --no-verify-jwt`). The webhook route authenticates Shopify with HMAC; the control actions validate the Supabase user and active owner/admin membership in the handler.
3. Ensure `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY`, and the Shopify client secret/signing-secret reference are available as edge-function secrets. Do not expose the service key or Shopify secret to clients.
4. Call `POST /functions/v1/hercules-shopify-bulk-reconciliation` with an owner/admin bearer token and `{"action":"start_orders","organization_id":"…"}`.
5. Monitor run state and watermark tables. For a failed/interrupted run, call the same endpoint with `{"action":"resume","run_id":"…"}` as an owner/admin.

The v1 branch does not install a recurring scheduler. Run starts are explicit and owner-authorized; recurring cadence needs an organization-owned scheduler or a separately reviewed trusted scheduler credential. Do not expose an unauthenticated scheduling action or store a long-lived user JWT in cron configuration.

## Verification

The focused Node tests cover the streaming parser, exact-byte HMAC verification, SQL/handler contract, watermark gate, and workflow test wiring. CI also runs the repository's Hercules execution-contract verifier. Applying migrations and deploying the function remain post-merge operational steps.
