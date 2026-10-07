create table if not exists public.hercules_supabase_management_oauth (
  singleton boolean primary key default true check (singleton),
  project_ref text not null default 'xbwuablxhhwsaoomsoco'
    check (project_ref='xbwuablxhhwsaoomsoco'),
  client_id text,
  client_secret_secret_ref uuid,
  access_token_secret_ref uuid,
  refresh_token_secret_ref uuid,
  pkce_verifier_secret_ref uuid,
  oauth_state_sha256 text,
  redirect_uri text,
  scope text not null default 'auth:write' check (scope='auth:write'),
  purpose text not null default 'supabase-management-auth'
    check (purpose='supabase-management-auth'),
  status text not null default 'unconfigured'
    check (status in ('unconfigured','registered','pending_authorization','configured','expired','disabled')),
  oauth_started_at timestamptz,
  authorized_at timestamptz,
  token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.hercules_supabase_management_oauth enable row level security;
alter table public.hercules_supabase_management_oauth force row level security;
revoke all on table public.hercules_supabase_management_oauth from public, anon, authenticated;
grant select, insert, update on table public.hercules_supabase_management_oauth to service_role;

insert into public.hercules_supabase_management_oauth(singleton)
values(true) on conflict(singleton) do nothing;

create or replace function public.hercules_supabase_management_store_registration(
  p_client_id text, p_client_secret text, p_redirect_uri text
) returns boolean
language plpgsql security definer set search_path=public,vault
as $$
declare v_ref uuid;
begin
  if length(trim(coalesce(p_client_id,''))) < 4 then raise exception 'supabase_management_client_id_invalid'; end if;
  if length(trim(coalesce(p_client_secret,''))) < 8 then raise exception 'supabase_management_client_secret_invalid'; end if;
  if coalesce(p_redirect_uri,'') !~ '^https://' then raise exception 'supabase_management_redirect_uri_invalid'; end if;
  select client_secret_secret_ref into v_ref from public.hercules_supabase_management_oauth where singleton=true for update;
  if v_ref is null then
    v_ref:=public.hercules_store_secret(p_client_secret,'supabase-management-client-secret','Hercules Supabase Management OAuth client secret.');
  else
    perform vault.update_secret(v_ref,p_client_secret,'supabase-management-client-secret','Hercules Supabase Management OAuth client secret.',null);
  end if;
  update public.hercules_supabase_management_oauth set client_id=trim(p_client_id),client_secret_secret_ref=v_ref,
    redirect_uri=p_redirect_uri,status=case when status='configured' then status else 'registered' end,updated_at=now()
  where singleton=true;
  p_client_secret:=null; return true;
end $$;

create or replace function public.hercules_supabase_management_begin_authorization(p_state text,p_verifier text)
returns boolean language plpgsql security definer set search_path=public,vault,extensions
as $$
declare v_ref uuid;
begin
  if length(coalesce(p_state,'')) < 32 then raise exception 'supabase_management_state_invalid'; end if;
  if length(coalesce(p_verifier,'')) < 43 then raise exception 'supabase_management_pkce_invalid'; end if;
  select pkce_verifier_secret_ref into v_ref from public.hercules_supabase_management_oauth where singleton=true for update;
  if v_ref is null then
    v_ref:=public.hercules_store_secret(p_verifier,'supabase-management-pkce-verifier','Short-lived PKCE verifier for Hercules Supabase Management OAuth.');
  else
    perform vault.update_secret(v_ref,p_verifier,'supabase-management-pkce-verifier','Short-lived PKCE verifier for Hercules Supabase Management OAuth.',null);
  end if;
  update public.hercules_supabase_management_oauth set pkce_verifier_secret_ref=v_ref,
    oauth_state_sha256=encode(extensions.digest(p_state,'sha256'),'hex'),status='pending_authorization',
    oauth_started_at=now(),updated_at=now() where singleton=true;
  p_state:=null;p_verifier:=null;return true;
end $$;

create or replace function public.hercules_supabase_management_complete_authorization(
  p_state text,p_access_token text,p_refresh_token text,p_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path=public,vault,extensions
as $$
declare v_expected text;v_started timestamptz;v_access uuid;v_refresh uuid;
begin
  select oauth_state_sha256,oauth_started_at,access_token_secret_ref,refresh_token_secret_ref
  into v_expected,v_started,v_access,v_refresh from public.hercules_supabase_management_oauth where singleton=true for update;
  if v_expected is null or v_expected<>encode(extensions.digest(coalesce(p_state,''),'sha256'),'hex')
    or v_started is null or v_started<now()-interval '20 minutes' then raise exception 'oauth_state_mismatch'; end if;
  if length(trim(coalesce(p_access_token,'')))<20 then raise exception 'supabase_management_access_token_invalid'; end if;
  if v_access is null then
    v_access:=public.hercules_store_secret(p_access_token,'supabase-management-access-token','Hercules Supabase Management OAuth access token.');
  else
    perform vault.update_secret(v_access,p_access_token,'supabase-management-access-token','Hercules Supabase Management OAuth access token.',null);
  end if;
  if length(trim(coalesce(p_refresh_token,'')))>=20 then
    if v_refresh is null then
      v_refresh:=public.hercules_store_secret(p_refresh_token,'supabase-management-refresh-token','Hercules Supabase Management OAuth refresh token.');
    else
      perform vault.update_secret(v_refresh,p_refresh_token,'supabase-management-refresh-token','Hercules Supabase Management OAuth refresh token.',null);
    end if;
  end if;
  update public.hercules_supabase_management_oauth set access_token_secret_ref=v_access,refresh_token_secret_ref=v_refresh,
    token_expires_at=p_expires_at,status='configured',authorized_at=now(),oauth_state_sha256=null,oauth_started_at=null,updated_at=now()
  where singleton=true;
  p_state:=null;p_access_token:=null;p_refresh_token:=null;return true;
end $$;

create or replace function public.hercules_supabase_management_refresh_tokens(
  p_access_token text,p_refresh_token text,p_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path=public,vault
as $$
declare v_access uuid;v_refresh uuid;
begin
  select access_token_secret_ref,refresh_token_secret_ref into v_access,v_refresh
  from public.hercules_supabase_management_oauth where singleton=true and status='configured' for update;
  if v_access is null then raise exception 'supabase_management_not_authorized'; end if;
  if length(trim(coalesce(p_access_token,'')))<20 then raise exception 'supabase_management_access_token_invalid'; end if;
  perform vault.update_secret(v_access,p_access_token,'supabase-management-access-token','Hercules Supabase Management OAuth access token.',null);
  if length(trim(coalesce(p_refresh_token,'')))>=20 then
    if v_refresh is null then
      v_refresh:=public.hercules_store_secret(p_refresh_token,'supabase-management-refresh-token','Hercules Supabase Management OAuth refresh token.');
    else
      perform vault.update_secret(v_refresh,p_refresh_token,'supabase-management-refresh-token','Hercules Supabase Management OAuth refresh token.',null);
    end if;
  end if;
  update public.hercules_supabase_management_oauth set refresh_token_secret_ref=v_refresh,token_expires_at=p_expires_at,updated_at=now()
  where singleton=true;
  p_access_token:=null;p_refresh_token:=null;return true;
end $$;
