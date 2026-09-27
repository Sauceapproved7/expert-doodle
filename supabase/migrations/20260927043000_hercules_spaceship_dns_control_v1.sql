create table if not exists public.hercules_spaceship_dns_credentials (
  singleton boolean primary key default true check (singleton),
  api_key_secret_ref uuid,
  api_secret_secret_ref uuid,
  status text not null default 'unconfigured' check (status in ('unconfigured','configured','disabled')),
  configured_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'configured' and api_key_secret_ref is not null and api_secret_secret_ref is not null)
    or status <> 'configured'
  )
);

alter table public.hercules_spaceship_dns_credentials enable row level security;
alter table public.hercules_spaceship_dns_credentials force row level security;
revoke all on table public.hercules_spaceship_dns_credentials from public, anon, authenticated;
grant select, insert, update on table public.hercules_spaceship_dns_credentials to service_role;

insert into public.hercules_spaceship_dns_credentials(singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.hercules_spaceship_dns_runs (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null unique,
  action text not null check (action in ('inspect_shopify_dns','reconcile_shopify_dns')),
  status text not null default 'running' check (status in ('running','succeeded','conflict','failed')),
  domain text not null default 'sauceapproved.com' check (domain = 'sauceapproved.com'),
  replace_custom_conflicts boolean not null default false,
  summary jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.hercules_spaceship_dns_runs enable row level security;
alter table public.hercules_spaceship_dns_runs force row level security;
revoke all on table public.hercules_spaceship_dns_runs from public, anon, authenticated;
grant select, insert, update on table public.hercules_spaceship_dns_runs to service_role;

do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose = 'spaceship-dns'
  ) then
    v_internal_key := encode(extensions.gen_random_bytes(32), 'hex');
    v_secret_ref := public.hercules_store_secret(
      v_internal_key,
      'hercules-spaceship-dns-internal',
      'Internal authentication key for the Hercules Spaceship DNS control surface.'
    );

    insert into public.hercules_internal_service_keys(
      purpose, key_sha256, enabled, rotated_at, metadata, secret_ref
    )
    values (
      'spaceship-dns',
      encode(extensions.digest(v_internal_key, 'sha256'), 'hex'),
      true,
      now(),
      '{"scope":"spaceship-dns","owner":"Hercules","credentialType":"internal-control"}'::jsonb,
      v_secret_ref
    );
    v_internal_key := null;
  end if;
end
$$;

create or replace function public.hercules_spaceship_dns_configure_credentials(
  p_api_key text,
  p_api_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_api_key_ref uuid;
  v_api_secret_ref uuid;
begin
  if p_api_key is null or length(trim(p_api_key)) < 8 or length(p_api_key) > 2048 then
    raise exception 'spaceship_api_key_invalid';
  end if;
  if p_api_secret is null or length(trim(p_api_secret)) < 8 or length(p_api_secret) > 4096 then
    raise exception 'spaceship_api_secret_invalid';
  end if;

  select api_key_secret_ref, api_secret_secret_ref
    into v_api_key_ref, v_api_secret_ref
    from public.hercules_spaceship_dns_credentials
   where singleton = true
   for update;

  if v_api_key_ref is null then
    v_api_key_ref := public.hercules_store_secret(
      p_api_key,
      'spaceship-dns-api-key',
      'Spaceship External API key for SauceApproved DNS automation.'
    );
  else
    perform vault.update_secret(
      v_api_key_ref,
      p_api_key,
      'spaceship-dns-api-key',
      'Spaceship External API key for SauceApproved DNS automation.',
      null
    );
  end if;

  if v_api_secret_ref is null then
    v_api_secret_ref := public.hercules_store_secret(
      p_api_secret,
      'spaceship-dns-api-secret',
      'Spaceship External API secret for SauceApproved DNS automation.'
    );
  else
    perform vault.update_secret(
      v_api_secret_ref,
      p_api_secret,
      'spaceship-dns-api-secret',
      'Spaceship External API secret for SauceApproved DNS automation.',
      null
    );
  end if;

  update public.hercules_spaceship_dns_credentials
     set api_key_secret_ref = v_api_key_ref,
         api_secret_secret_ref = v_api_secret_ref,
         status = 'configured',
         configured_at = now(),
         updated_at = now()
   where singleton = true;

  p_api_key := null;
  p_api_secret := null;
  return true;
end;
$$;

revoke all on function public.hercules_spaceship_dns_configure_credentials(text,text)
  from public, anon, authenticated;
grant execute on function public.hercules_spaceship_dns_configure_credentials(text,text)
  to service_role;

create or replace function public.hercules_spaceship_dns_submit(
  p_action text,
  p_replace_custom_conflicts boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_ref uuid;
  v_internal_key text;
  v_request_id bigint;
  v_edge_action text;
begin
  if p_action = 'inspect' then
    v_edge_action := 'inspect_shopify_dns';
  elsif p_action = 'reconcile' then
    v_edge_action := 'reconcile_shopify_dns';
  else
    raise exception 'spaceship_dns_action_not_allowed';
  end if;

  if p_action = 'inspect' and p_replace_custom_conflicts then
    raise exception 'replace_flag_not_allowed_for_inspect';
  end if;

  select secret_ref
    into v_secret_ref
    from public.hercules_internal_service_keys
   where purpose = 'spaceship-dns'
     and enabled = true
   limit 1;

  if v_secret_ref is null then
    raise exception 'spaceship_dns_internal_secret_missing';
  end if;

  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key) < 32 then
    raise exception 'spaceship_dns_internal_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-spaceship-dns',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hercules-internal-key', v_internal_key
    ),
    body := jsonb_build_object(
      'action', v_edge_action,
      'replaceCustomConflicts', coalesce(p_replace_custom_conflicts, false)
    ),
    timeout_milliseconds := 65000
  )
  into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_spaceship_dns_submit(text,boolean)
  from public, anon, authenticated;
grant execute on function public.hercules_spaceship_dns_submit(text,boolean)
  to service_role;

create or replace function public.hercules_spaceship_dns_result(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_body jsonb;
begin
  select id, status_code, content_type, content, timed_out, error_msg, created
    into v_row
    from net._http_response
   where id = p_request_id
   limit 1;

  if not found then
    return jsonb_build_object('ready', false, 'requestId', p_request_id);
  end if;

  begin
    v_body := v_row.content::jsonb;
  exception when others then
    v_body := jsonb_build_object('raw', left(coalesce(v_row.content,''), 20000));
  end;

  return jsonb_build_object(
    'ready', true,
    'requestId', v_row.id,
    'statusCode', v_row.status_code,
    'contentType', v_row.content_type,
    'timedOut', v_row.timed_out,
    'error', v_row.error_msg,
    'created', v_row.created,
    'body', v_body
  );
end;
$$;

revoke all on function public.hercules_spaceship_dns_result(bigint)
  from public, anon, authenticated;
grant execute on function public.hercules_spaceship_dns_result(bigint)
  to service_role;

comment on table public.hercules_spaceship_dns_credentials is
  'Secret references only for Spaceship DNS automation. Raw credentials live in Vault.';
comment on table public.hercules_spaceship_dns_runs is
  'Compact audit records for SauceApproved Spaceship DNS inspection and reconciliation.';
comment on function public.hercules_spaceship_dns_configure_credentials(text,text) is
  'Service-role-only credential provisioning. Stores values in Vault and never returns them.';
comment on function public.hercules_spaceship_dns_submit(text,boolean) is
  'Service-role-only async bridge to the fixed SauceApproved Spaceship DNS Edge Function.';
comment on function public.hercules_spaceship_dns_result(bigint) is
  'Reads the pg_net result for a submitted Spaceship DNS control request.';
