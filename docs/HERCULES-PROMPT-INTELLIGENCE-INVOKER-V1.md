# Smallz replay RPC: invoker privilege hardening

The existing trace claim function was created as `SECURITY DEFINER`, although its only authorized caller is the database `service_role`, which already has the required table grants and RLS bypass permission. This adds an unnecessary privileged execution boundary.

A **test-first** disposable PostgreSQL check reproduced the failure: the function was still definer-scoped. The corrective migration `20261015190000_hercules_prompt_trace_invoker_v1.sql` switches the existing function to `SECURITY INVOKER`, preserves explicit service-role-only execute privileges, and verifies the change. The regression invokes sequence reservation and replay claims while actually executing as `service_role`, including duplicate rejection. It also checks that `authenticated` has no execute permission.

**Scope:** source-only. No live Supabase schema changes, keys, Render settings, paid resources, or production browser enforcement. Isolated real PostgREST HTTP and real Smallz browser staging are still outstanding; the existing disposable PostgreSQL CI is not an external staging environment.

**Rollout:** install and test the replay migrations in their existing order on isolated staging, apply this hardening migration last, run security advisors, then validate real service-role RPC, anonymous denial, concurrent claims, and browser dispatch. Keep trace enforcement disabled until verified. If staging fails, discard the isolated environment; preserve any production replay counters if later rolled out.
