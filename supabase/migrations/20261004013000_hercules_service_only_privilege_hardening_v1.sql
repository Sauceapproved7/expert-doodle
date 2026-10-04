-- Hercules service-only privilege hardening v1
-- Provenance: internal Supabase Security Advisor + pg_catalog privilege audit, 2026-10-04.
-- These tables are service-internal. RLS remains enabled; direct client table privileges are removed.

begin;

revoke all on table public.hercules_app_deploy_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_app_deploy_tokens to service_role;

revoke all on table public.hercules_attestation_bootstrap_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_attestation_bootstrap_tokens to service_role;

revoke all on table public.hercules_backend_bootstrap_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_backend_bootstrap_tokens to service_role;

revoke all on table public.hercules_execution_secret_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_execution_secret_grants to service_role;

revoke all on table public.hercules_internal_service_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_internal_service_keys to service_role;

revoke all on table public.hercules_source_content_import_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_source_content_import_tokens to service_role;

revoke all on table public.hercules_trading_connect_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_trading_connect_tokens to service_role;

commit;
