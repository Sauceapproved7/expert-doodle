alter table public.hercules_forge_state_chunks
  add column if not exists object_sha256 text;

update public.hercules_forge_state_chunks c
set object_sha256=o.sha256
from public.hercules_forge_state_objects o
where c.path=o.path and c.object_sha256 is null;

delete from public.hercules_forge_state_chunks
where object_sha256 is null;

alter table public.hercules_forge_state_chunks
  alter column object_sha256 set not null;

alter table public.hercules_forge_state_chunks
  drop constraint if exists hercules_forge_state_chunks_pkey;

alter table public.hercules_forge_state_chunks
  add constraint hercules_forge_state_chunks_pkey
  primary key (path, object_sha256, chunk_index);

alter table public.hercules_forge_state_chunks
  drop constraint if exists hercules_forge_state_chunks_object_sha_check;

alter table public.hercules_forge_state_chunks
  add constraint hercules_forge_state_chunks_object_sha_check
  check (object_sha256 ~ '^[a-f0-9]{64}$');

drop index if exists public.hercules_forge_state_chunks_path_idx;

create index if not exists hercules_forge_state_chunks_path_object_idx
  on public.hercules_forge_state_chunks(path, object_sha256, chunk_index);
