-- Hercules Chat DPoP persistence v1
-- Server-owned sender binding and atomic replay state. No production rollout is enabled here.

create table if not exists private.hercules_dpop_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  jkt text not null check (char_length(jkt) between 20 and 256),
  enabled boolean not null default false,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.hercules_dpop_replays (
  replay_key text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table private.hercules_dpop_keys enable row level security;
alter table private.hercules_dpop_replays enable row level security;
revoke all on table private.hercules_dpop_keys from public, anon, authenticated;
revoke all on table private.hercules_dpop_replays from public, anon, authenticated;
grant select, insert, update, delete on private.hercules_dpop_keys to service_role;
grant select, insert, delete on private.hercules_dpop_replays to service_role;

create or replace function public.hercules_get_dpop_key(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select k.jkt from private.hercules_dpop_keys k
  where k.user_id = p_user_id and k.enabled = true;
$$;

revoke all on function public.hercules_get_dpop_key(uuid) from public, anon, authenticated;
grant execute on function public.hercules_get_dpop_key(uuid) to service_role;

create or replace function public.hercules_claim_dpop_replay(
  p_replay_key text,
  p_ttl_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
begin
  if p_replay_key is null or char_length(p_replay_key) < 1
     or p_ttl_seconds < 1 or p_ttl_seconds > 600 then
    return false;
  end if;

  delete from private.hercules_dpop_replays where expires_at <= clock_timestamp();

  insert into private.hercules_dpop_replays(replay_key, expires_at)
  values (p_replay_key, clock_timestamp() + make_interval(secs => p_ttl_seconds))
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.hercules_claim_dpop_replay(text, integer) from public, anon, authenticated;
grant execute on function public.hercules_claim_dpop_replay(text, integer) to service_role;


-- Reconcile legacy production-only authenticated SECURITY DEFINER RPC drift.
-- Canonical DPoP persistence is server-owned; authenticated clients must not
-- receive direct privileged database mutation authority.
drop function if exists public.hercules_create_dpop_challenge();
drop function if exists public.hercules_revoke_dpop_key(text);
