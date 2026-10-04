begin;

alter table public.hercules_hurc_test_signers force row level security;

revoke all on table public.hercules_hurc_test_signers from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_hurc_test_signers to service_role;

commit;
