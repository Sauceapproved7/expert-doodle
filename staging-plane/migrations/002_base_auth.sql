begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='staging_auth') then
    create role staging_auth noinherit nologin;
  end if;
end
$$;

grant staging_auth to hercules_api;
grant usage on schema staging_api to staging_auth;

create table if not exists staging_api.auth_users (
  id uuid primary key,
  email text not null,
  password_digest text not null,
  password_salt text not null,
  password_params jsonb not null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  check (email=lower(email)),
  check (char_length(email) between 3 and 320),
  check (password_params ? 'algorithm')
);

create unique index if not exists auth_users_email_lower_idx
  on staging_api.auth_users (lower(email));

create table if not exists staging_api.auth_sessions (
  id uuid primary key,
  user_id uuid not null references staging_api.auth_users(id) on delete cascade,
  refresh_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (char_length(refresh_token_hash)=64)
);

create index if not exists auth_sessions_user_idx
  on staging_api.auth_sessions (user_id, created_at desc);

create index if not exists auth_sessions_active_idx
  on staging_api.auth_sessions (expires_at)
  where revoked_at is null;

alter table staging_api.auth_users enable row level security;
alter table staging_api.auth_sessions enable row level security;

revoke all on staging_api.auth_users from public;
revoke all on staging_api.auth_sessions from public;
revoke all on staging_api.auth_users from staging_anon,staging_user,staging_auth;
revoke all on staging_api.auth_sessions from staging_anon,staging_user,staging_auth;

create or replace function staging_api.auth_register(
  p_id uuid,
  p_email text,
  p_password_digest text,
  p_password_salt text,
  p_password_params jsonb
)
returns table(id uuid,email text)
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_email is null or p_email<>lower(p_email)
     or char_length(p_email) not between 3 and 320 then
    raise exception 'INVALID_EMAIL';
  end if;
  if p_password_digest is null or p_password_salt is null
     or p_password_params is null then
    raise exception 'INVALID_PASSWORD_RECORD';
  end if;

  insert into staging_api.auth_users(
    id,email,password_digest,password_salt,password_params
  ) values (
    p_id,p_email,p_password_digest,p_password_salt,p_password_params
  );

  return query
  select u.id,u.email
  from staging_api.auth_users u
  where u.id=p_id;
end;
$$;

create or replace function staging_api.auth_lookup(p_email text)
returns table(
  id uuid,
  email text,
  password_digest text,
  password_salt text,
  password_params jsonb,
  disabled_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select
    u.id,u.email,u.password_digest,u.password_salt,u.password_params,u.disabled_at
  from staging_api.auth_users u
  where u.email=lower(p_email)
  limit 1;
$$;

create or replace function staging_api.auth_create_session(
  p_id uuid,
  p_user_id uuid,
  p_refresh_token_hash text,
  p_expires_at timestamptz
)
returns table(id uuid,user_id uuid,email text,expires_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_expires_at<=now() then
    raise exception 'INVALID_SESSION_EXPIRY';
  end if;

  insert into staging_api.auth_sessions(
    id,user_id,refresh_token_hash,expires_at
  ) values (
    p_id,p_user_id,p_refresh_token_hash,p_expires_at
  );

  return query
  select s.id,s.user_id,u.email,s.expires_at
  from staging_api.auth_sessions s
  join staging_api.auth_users u on u.id=s.user_id
  where s.id=p_id and u.disabled_at is null;
end;
$$;

create or replace function staging_api.auth_rotate_session(
  p_refresh_token_hash text,
  p_new_refresh_token_hash text,
  p_new_expires_at timestamptz
)
returns table(id uuid,user_id uuid,email text,expires_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_session_id uuid;
  v_user_id uuid;
begin
  select s.id,s.user_id
    into v_session_id,v_user_id
  from staging_api.auth_sessions s
  join staging_api.auth_users u on u.id=s.user_id
  where s.refresh_token_hash=p_refresh_token_hash
    and s.revoked_at is null
    and s.expires_at>now()
    and u.disabled_at is null
  for update;

  if not found then
    raise exception 'INVALID_REFRESH_TOKEN';
  end if;

  update staging_api.auth_sessions as s
  set refresh_token_hash=p_new_refresh_token_hash,
      last_used_at=now(),
      expires_at=p_new_expires_at
  where s.id=v_session_id;

  return query
  select s.id,s.user_id,u.email,s.expires_at
  from staging_api.auth_sessions s
  join staging_api.auth_users u on u.id=s.user_id
  where s.id=v_session_id;
end;
$$;

create or replace function staging_api.auth_revoke_session(
  p_refresh_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  update staging_api.auth_sessions
  set revoked_at=coalesce(revoked_at,now())
  where refresh_token_hash=p_refresh_token_hash
    and revoked_at is null;
  return found;
end;
$$;

revoke all on function staging_api.auth_register(uuid,text,text,text,jsonb)
from public,staging_anon,staging_user;
revoke all on function staging_api.auth_lookup(text)
from public,staging_anon,staging_user;
revoke all on function staging_api.auth_create_session(uuid,uuid,text,timestamptz)
from public,staging_anon,staging_user;
revoke all on function staging_api.auth_rotate_session(text,text,timestamptz)
from public,staging_anon,staging_user;
revoke all on function staging_api.auth_revoke_session(text)
from public,staging_anon,staging_user;

grant execute on function staging_api.auth_register(uuid,text,text,text,jsonb)
to staging_auth;
grant execute on function staging_api.auth_lookup(text)
to staging_auth;
grant execute on function staging_api.auth_create_session(uuid,uuid,text,timestamptz)
to staging_auth;
grant execute on function staging_api.auth_rotate_session(text,text,timestamptz)
to staging_auth;
grant execute on function staging_api.auth_revoke_session(text)
to staging_auth;

commit;
