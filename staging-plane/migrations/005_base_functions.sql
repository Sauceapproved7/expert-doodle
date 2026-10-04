begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='staging_functions') then
    create role staging_functions noinherit nologin;
  end if;
end
$$;

grant staging_functions to hercules_api;
grant usage on schema staging_api to staging_functions;

create table if not exists staging_api.function_manifests (
  id uuid primary key,
  owner_id uuid not null,
  name text not null,
  runtime text not null,
  entrypoint text not null,
  timeout_ms integer not null,
  memory_mb integer not null,
  network_policy text not null,
  source_sha256 text not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,name),
  check (char_length(name) between 1 and 63),
  check (runtime in ('node22')),
  check (timeout_ms between 100 and 30000),
  check (memory_mb between 32 and 1024),
  check (network_policy in ('none','egress-allowlist')),
  check (source_sha256 ~ '^[a-f0-9]{64}$'),
  check (fingerprint ~ '^[a-f0-9]{64}$')
);

create table if not exists staging_api.function_invocations (
  id uuid primary key,
  function_id uuid not null references staging_api.function_manifests(id) on delete cascade,
  owner_id uuid not null,
  status text not null,
  executor_kind text,
  request_sha256 text,
  result_sha256 text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  check (status in ('accepted','running','completed','failed','cancelled')),
  check (request_sha256 is null or request_sha256 ~ '^[a-f0-9]{64}$'),
  check (result_sha256 is null or result_sha256 ~ '^[a-f0-9]{64}$')
);

create index if not exists function_manifests_owner_idx
  on staging_api.function_manifests(owner_id,updated_at desc);
create index if not exists function_invocations_owner_idx
  on staging_api.function_invocations(owner_id,started_at desc);

alter table staging_api.function_manifests enable row level security;
alter table staging_api.function_invocations enable row level security;

revoke all on staging_api.function_manifests from public;
revoke all on staging_api.function_invocations from public;
revoke all on staging_api.function_manifests
from staging_anon,staging_user,staging_auth,staging_storage,staging_realtime,staging_functions;
revoke all on staging_api.function_invocations
from staging_anon,staging_user,staging_auth,staging_storage,staging_realtime,staging_functions;

create or replace function staging_api.functions_register(
  p_id uuid,
  p_owner_id uuid,
  p_name text,
  p_runtime text,
  p_entrypoint text,
  p_timeout_ms integer,
  p_memory_mb integer,
  p_network_policy text,
  p_source_sha256 text,
  p_fingerprint text
)
returns table(
  id uuid,
  name text,
  runtime text,
  entrypoint text,
  timeout_ms integer,
  memory_mb integer,
  network_policy text,
  source_sha256 text,
  fingerprint text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into staging_api.function_manifests as f(
    id,owner_id,name,runtime,entrypoint,timeout_ms,memory_mb,
    network_policy,source_sha256,fingerprint
  ) values (
    p_id,p_owner_id,p_name,p_runtime,p_entrypoint,p_timeout_ms,p_memory_mb,
    p_network_policy,p_source_sha256,p_fingerprint
  )
  on conflict on constraint function_manifests_owner_id_name_key do update
    set runtime=excluded.runtime,
        entrypoint=excluded.entrypoint,
        timeout_ms=excluded.timeout_ms,
        memory_mb=excluded.memory_mb,
        network_policy=excluded.network_policy,
        source_sha256=excluded.source_sha256,
        fingerprint=excluded.fingerprint,
        updated_at=now();

  return query
  select f.id,f.name,f.runtime,f.entrypoint,f.timeout_ms,f.memory_mb,
         f.network_policy,f.source_sha256,f.fingerprint,f.updated_at
  from staging_api.function_manifests f
  where f.owner_id=p_owner_id and f.name=p_name;
end;
$$;

create or replace function staging_api.functions_get(
  p_owner_id uuid,
  p_name text
)
returns table(
  id uuid,
  name text,
  runtime text,
  entrypoint text,
  timeout_ms integer,
  memory_mb integer,
  network_policy text,
  source_sha256 text,
  fingerprint text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select f.id,f.name,f.runtime,f.entrypoint,f.timeout_ms,f.memory_mb,
         f.network_policy,f.source_sha256,f.fingerprint,f.updated_at
  from staging_api.function_manifests f
  where f.owner_id=p_owner_id and f.name=p_name
  limit 1;
$$;

create or replace function staging_api.functions_list(
  p_owner_id uuid
)
returns table(
  id uuid,
  name text,
  runtime text,
  entrypoint text,
  timeout_ms integer,
  memory_mb integer,
  network_policy text,
  source_sha256 text,
  fingerprint text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select f.id,f.name,f.runtime,f.entrypoint,f.timeout_ms,f.memory_mb,
         f.network_policy,f.source_sha256,f.fingerprint,f.updated_at
  from staging_api.function_manifests f
  where f.owner_id=p_owner_id
  order by f.name;
$$;

revoke all on function staging_api.functions_register(uuid,uuid,text,text,text,integer,integer,text,text,text)
from public,staging_anon,staging_user,staging_auth,staging_storage,staging_realtime;
revoke all on function staging_api.functions_get(uuid,text)
from public,staging_anon,staging_user,staging_auth,staging_storage,staging_realtime;
revoke all on function staging_api.functions_list(uuid)
from public,staging_anon,staging_user,staging_auth,staging_storage,staging_realtime;

grant execute on function staging_api.functions_register(uuid,uuid,text,text,text,integer,integer,text,text,text)
to staging_functions;
grant execute on function staging_api.functions_get(uuid,text)
to staging_functions;
grant execute on function staging_api.functions_list(uuid)
to staging_functions;

commit;
