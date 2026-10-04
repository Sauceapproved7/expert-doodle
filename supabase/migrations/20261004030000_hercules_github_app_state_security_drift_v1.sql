begin;

alter table public.hercules_github_app_states force row level security;

revoke all on table public.hercules_github_app_states from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_github_app_states to service_role;

commit;
