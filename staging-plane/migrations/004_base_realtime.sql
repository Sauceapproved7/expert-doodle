begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='staging_realtime') then
    create role staging_realtime noinherit nologin;
  end if;
end
$$;

grant staging_realtime to hercules_api;
grant usage on schema staging_api to staging_realtime;

create table if not exists staging_api.realtime_channels (
  id uuid primary key,
  owner_id uuid not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id,name),
  check (char_length(name) between 1 and 63)
);

create table if not exists staging_api.realtime_events (
  id bigint generated always as identity primary key,
  channel_id uuid not null references staging_api.realtime_channels(id) on delete cascade,
  owner_id uuid not null,
  event_name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  check (char_length(event_name) between 1 and 96)
);

create index if not exists realtime_events_channel_id_idx
  on staging_api.realtime_events(channel_id,id);

create index if not exists realtime_events_owner_id_idx
  on staging_api.realtime_events(owner_id,id desc);

alter table staging_api.realtime_channels enable row level security;
alter table staging_api.realtime_events enable row level security;

revoke all on staging_api.realtime_channels from public;
revoke all on staging_api.realtime_events from public;
revoke all on staging_api.realtime_channels from staging_anon,staging_user,staging_auth,staging_storage,staging_realtime;
revoke all on staging_api.realtime_events from staging_anon,staging_user,staging_auth,staging_storage,staging_realtime;

create or replace function staging_api.realtime_create_channel(
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
  insert into staging_api.realtime_channels as c(id,owner_id,name)
  values(p_id,p_owner_id,p_name)
  on conflict on constraint realtime_channels_owner_id_name_key do nothing;

  return query
  select c.id,c.owner_id,c.name,c.created_at
  from staging_api.realtime_channels c
  where c.owner_id=p_owner_id and c.name=p_name;
end;
$$;

create or replace function staging_api.realtime_publish(
  p_owner_id uuid,
  p_channel text,
  p_event_name text,
  p_payload jsonb
)
returns table(
  id bigint,
  channel text,
  event_name text,
  payload jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_channel_id uuid;
  v_event_id bigint;
begin
  select c.id into v_channel_id
  from staging_api.realtime_channels c
  where c.owner_id=p_owner_id and c.name=p_channel;

  if v_channel_id is null then
    raise exception 'CHANNEL_NOT_FOUND';
  end if;

  insert into staging_api.realtime_events(channel_id,owner_id,event_name,payload)
  values(v_channel_id,p_owner_id,p_event_name,p_payload)
  returning staging_api.realtime_events.id into v_event_id;

  return query
  select e.id,c.name,e.event_name,e.payload,e.created_at
  from staging_api.realtime_events e
  join staging_api.realtime_channels c on c.id=e.channel_id
  where e.id=v_event_id and e.owner_id=p_owner_id;
end;
$$;

create or replace function staging_api.realtime_poll(
  p_owner_id uuid,
  p_channel text,
  p_after_id bigint default 0,
  p_limit integer default 100
)
returns table(
  id bigint,
  event_name text,
  payload jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if p_after_id<0 or p_limit<1 or p_limit>200 then
    raise exception 'INVALID_REALTIME_CURSOR';
  end if;

  return query
  select e.id,e.event_name,e.payload,e.created_at
  from staging_api.realtime_events e
  join staging_api.realtime_channels c on c.id=e.channel_id
  where e.owner_id=p_owner_id
    and c.owner_id=p_owner_id
    and c.name=p_channel
    and e.id>p_after_id
  order by e.id
  limit p_limit;
end;
$$;

revoke all on function staging_api.realtime_create_channel(uuid,uuid,text)
from public,staging_anon,staging_user,staging_auth,staging_storage;
revoke all on function staging_api.realtime_publish(uuid,text,text,jsonb)
from public,staging_anon,staging_user,staging_auth,staging_storage;
revoke all on function staging_api.realtime_poll(uuid,text,bigint,integer)
from public,staging_anon,staging_user,staging_auth,staging_storage;

grant execute on function staging_api.realtime_create_channel(uuid,uuid,text)
to staging_realtime;
grant execute on function staging_api.realtime_publish(uuid,text,text,jsonb)
to staging_realtime;
grant execute on function staging_api.realtime_poll(uuid,text,bigint,integer)
to staging_realtime;

commit;
