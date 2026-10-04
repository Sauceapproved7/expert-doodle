begin;

alter table public.hercules_operator_commands force row level security;

revoke all on table public.hercules_operator_commands from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_operator_commands to service_role;

commit;
