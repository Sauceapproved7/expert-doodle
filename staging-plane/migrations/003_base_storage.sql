begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='staging_storage') then
    create role staging_storage noinherit nologin;
  end if;
end
$$;

grant staging_storage to hercules_api;
grant usage on schema staging_api to staging_storage;

create table if not exists staging_api.storage_buckets (
  id uuid primary key,
  owner_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id,name),
  check (char_length(name) between 3 and 63)
);

create table if not exists staging_api.storage_objects (
  id uuid primary key,
  bucket_id uuid not null references staging_api.storage_buckets(id) on delete cascade,
  owner_id uuid not null,
  object_key text not null,
  sha256 text not null,
  size_bytes bigint not null check (size_bytes>=0),
  content_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bucket_id,object_key),
  check (char_length(object_key) between 1 and 1024),
  check (sha256 ~ '^[a-f0-9]{64}$')
);

create index if not exists storage_objects_owner_idx
  on staging_api.storage_objects(owner_id,updated_at desc);
create index if not exists storage_objects_digest_idx
  on staging_api.storage_objects(sha256);

alter table staging_api.storage_buckets enable row level security;
alter table staging_api.storage_objects enable row level security;

revoke all on staging_api.storage_buckets from public;
revoke all on staging_api.storage_objects from public;
revoke all on staging_api.storage_buckets from staging_anon,staging_user,staging_auth,staging_storage;
revoke all on staging_api.storage_objects from staging_anon,staging_user,staging_auth,staging_storage;

create or replace function staging_api.storage_create_bucket(
  p_id uuid,
  p_owner_id uuid,
  p_name text
)
returns table(id uuid,owner_id uuid,name text,created_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into staging_api.storage_buckets(id,owner_id,name)
  values(p_id,p_owner_id,p_name)
  on conflict(owner_id,name) do nothing;

  return query
  select b.id,b.owner_id,b.name,b.created_at
  from staging_api.storage_buckets b
  where b.owner_id=p_owner_id and b.name=p_name;
end;
$$;

create or replace function staging_api.storage_put_object(
  p_id uuid,
  p_owner_id uuid,
  p_bucket text,
  p_object_key text,
  p_sha256 text,
  p_size_bytes bigint,
  p_content_type text
)
returns table(
  id uuid,
  bucket text,
  object_key text,
  sha256 text,
  size_bytes bigint,
  content_type text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_bucket_id uuid;
begin
  select b.id into v_bucket_id
  from staging_api.storage_buckets b
  where b.owner_id=p_owner_id and b.name=p_bucket;

  if v_bucket_id is null then
    raise exception 'BUCKET_NOT_FOUND';
  end if;

  insert into staging_api.storage_objects(
    id,bucket_id,owner_id,object_key,sha256,size_bytes,content_type
  ) values (
    p_id,v_bucket_id,p_owner_id,p_object_key,p_sha256,p_size_bytes,p_content_type
  )
  on conflict(bucket_id,object_key) do update
    set sha256=excluded.sha256,
        size_bytes=excluded.size_bytes,
        content_type=excluded.content_type,
        owner_id=excluded.owner_id,
        updated_at=now();

  return query
  select o.id,b.name,o.object_key,o.sha256,o.size_bytes,o.content_type,o.updated_at
  from staging_api.storage_objects o
  join staging_api.storage_buckets b on b.id=o.bucket_id
  where o.bucket_id=v_bucket_id and o.object_key=p_object_key and o.owner_id=p_owner_id;
end;
$$;

create or replace function staging_api.storage_get_object(
  p_owner_id uuid,
  p_bucket text,
  p_object_key text
)
returns table(
  id uuid,
  bucket text,
  object_key text,
  sha256 text,
  size_bytes bigint,
  content_type text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select o.id,b.name,o.object_key,o.sha256,o.size_bytes,o.content_type,o.updated_at
  from staging_api.storage_objects o
  join staging_api.storage_buckets b on b.id=o.bucket_id
  where o.owner_id=p_owner_id and b.owner_id=p_owner_id
    and b.name=p_bucket and o.object_key=p_object_key
  limit 1;
$$;

create or replace function staging_api.storage_delete_object(
  p_owner_id uuid,
  p_bucket text,
  p_object_key text
)
returns table(
  id uuid,
  sha256 text,
  size_bytes bigint
)
language sql
security definer
set search_path=''
as $$
  delete from staging_api.storage_objects o
  using staging_api.storage_buckets b
  where o.bucket_id=b.id
    and o.owner_id=p_owner_id
    and b.owner_id=p_owner_id
    and b.name=p_bucket
    and o.object_key=p_object_key
  returning o.id,o.sha256,o.size_bytes;
$$;

create or replace function staging_api.storage_list_objects(
  p_owner_id uuid,
  p_bucket text,
  p_prefix text default ''
)
returns table(
  object_key text,
  sha256 text,
  size_bytes bigint,
  content_type text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select o.object_key,o.sha256,o.size_bytes,o.content_type,o.updated_at
  from staging_api.storage_objects o
  join staging_api.storage_buckets b on b.id=o.bucket_id
  where o.owner_id=p_owner_id and b.owner_id=p_owner_id and b.name=p_bucket
    and o.object_key like p_prefix||'%'
  order by o.object_key
  limit 1000;
$$;

revoke all on function staging_api.storage_create_bucket(uuid,uuid,text)
from public,staging_anon,staging_user,staging_auth;
revoke all on function staging_api.storage_put_object(uuid,uuid,text,text,text,bigint,text)
from public,staging_anon,staging_user,staging_auth;
revoke all on function staging_api.storage_get_object(uuid,text,text)
from public,staging_anon,staging_user,staging_auth;
revoke all on function staging_api.storage_delete_object(uuid,text,text)
from public,staging_anon,staging_user,staging_auth;
revoke all on function staging_api.storage_list_objects(uuid,text,text)
from public,staging_anon,staging_user,staging_auth;

grant execute on function staging_api.storage_create_bucket(uuid,uuid,text) to staging_storage;
grant execute on function staging_api.storage_put_object(uuid,uuid,text,text,text,bigint,text) to staging_storage;
grant execute on function staging_api.storage_get_object(uuid,text,text) to staging_storage;
grant execute on function staging_api.storage_delete_object(uuid,text,text) to staging_storage;
grant execute on function staging_api.storage_list_objects(uuid,text,text) to staging_storage;

commit;
