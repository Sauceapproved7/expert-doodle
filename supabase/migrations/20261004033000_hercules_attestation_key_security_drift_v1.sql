begin;

alter table public.hercules_attestation_keys force row level security;

revoke all on table public.hercules_attestation_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_attestation_keys to service_role;

commit;
