# Shopify webhook runtime repair — October 13, 2026

The live `hercules-shopify-webhook` GET endpoint returned HTTP 500. Executing the deployed handler in a regression fixture reproduced `TypeError: URL is not a constructor`: the Supabase endpoint string was declared as `URL` and hid the global URL parser used by request routing. The bulk-reconciliation module had the same name collision in its download-URL validation.

Both modules now name the configuration value `SUPABASE_URL`, leaving the global URL constructor available. Bulk reconciliation also accepts the platform's modern default key bindings when legacy keys are absent, and reads `secret_ref`, the provider credential column used by the existing connection writer and database schema.

Four runtime regressions exercise the actual TypeScript handlers with mocked infrastructure: health routing with missing Shopify credentials, modern-key initialization and anonymous bulk rejection, provider credential lookup, and rejection of unsigned webhook delivery. All four failed before the repair. The existing paid-order, raw-HMAC, replay, tenant, and bulk-download contracts remain applicable.

The deployment must retain the existing webhook function's custom-authentication configuration. Include both handler modules and `supabase/functions/_shared/shopify-bulk-jsonl.mjs` in its bundle. Verify public GET status, anonymous bulk rejection, and unsigned webhook rejection after deployment. Missing native Shopify signing credentials must remain an explicit unavailable state.

This repair restores the runtime path. It does not grant Shopify API scopes, provision missing app credentials, prove a real payment, or establish successful paid activation or bank settlement.
