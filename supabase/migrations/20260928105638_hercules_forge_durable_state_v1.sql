create table if not exists public.hercules_forge_state_objects (
  path text primary key,
  sha256 text not null,
  bytes bigint not null,
  chunk_count integer not null,
  updated_at timestamptz not null default now(),
  constraint hercules_forge_state_objects_path_check check (
    length(path) between 3 and 1024
    and path ~ '^(projects|identity|audit|runtime-data|runtime-snapshots|releases)/'
    and path !~ '(^|/)\.{1,2}(/|$)'
    and position(E'\\\\' in path)=0
  ),
  constraint hercules_forge_state_objects_sha_check check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint hercules_forge_state_objects_bytes_check check (bytes between 0 and 67108864),
  constraint hercules_forge_state_objects_chunks_check check (chunk_count between 1 and 4096)
);

create table if not exists public.hercules_forge_state_chunks (
  path text not null,
  chunk_index integer not null,
  sha256 text not null,
  bytes integer not null,
  content_base64 text not null,
  updated_at timestamptz not null default now(),
  primary key (path, chunk_index),
  constraint hercules_forge_state_chunks_path_check check (
    length(path) between 3 and 1024
    and path ~ '^(projects|identity|audit|runtime-data|runtime-snapshots|releases)/'
    and path !~ '(^|/)\.{1,2}(/|$)'
    and position(E'\\\\' in path)=0
  ),
  constraint hercules_forge_state_chunks_index_check check (chunk_index between 0 and 4095),
  constraint hercules_forge_state_chunks_sha_check check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint hercules_forge_state_chunks_bytes_check check (bytes between 0 and 1048576),
  constraint hercules_forge_state_chunks_content_check check (length(content_base64) <= 1500000)
);

create index if not exists hercules_forge_state_objects_updated_idx
  on public.hercules_forge_state_objects(updated_at desc);

create index if not exists hercules_forge_state_chunks_path_idx
  on public.hercules_forge_state_chunks(path, chunk_index);

alter table public.hercules_forge_state_objects enable row level security;
alter table public.hercules_forge_state_chunks enable row level security;

revoke all on table public.hercules_forge_state_objects from public, anon, authenticated;
revoke all on table public.hercules_forge_state_chunks from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_forge_state_objects to service_role;
grant select, insert, update, delete on table public.hercules_forge_state_chunks to service_role;

do $$
declare
  v_secret text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='forge-durable-state'
  ) then
    v_secret := encode(gen_random_bytes(32),'hex');
    select vault.create_secret(
      v_secret,
      'hercules-forge-durable-state',
      'Hercules Forge durable state internal service key'
    ) into v_secret_ref;

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'forge-durable-state',
      encode(digest(v_secret,'sha256'),'hex'),
      true,
      now(),
      jsonb_build_object(
        'scope','forge-durable-state',
        'credential_custody','supabase_vault',
        'carries_credentials',false,
        'version','v1'
      ),
      v_secret_ref
    );
    v_secret := null;
  end if;
end $$;
