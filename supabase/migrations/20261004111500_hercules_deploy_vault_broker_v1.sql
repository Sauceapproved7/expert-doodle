create table if not exists public.hercules_deploy_targets (
  code text primary key check (code ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  provider text not null check (provider in ('render')),
  service_id text not null unique check (service_id ~ '^srv-[a-z0-9]+$'),
  public_origin text not null check (public_origin ~ '^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?/$'),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hercules_deploy_targets enable row level security;
alter table public.hercules_deploy_targets force row level security;
revoke all on table public.hercules_deploy_targets from public, anon, authenticated;
grant select on table public.hercules_deploy_targets to service_role;

insert into public.hercules_deploy_targets(code,provider,service_id,public_origin,enabled)
values('hercules-mcp-production','render','srv-db0sic6gekts73b40jcg','https://hercules-mcp.onrender.com/',true)
on conflict(code) do update
set provider=excluded.provider,
    service_id=excluded.service_id,
    public_origin=excluded.public_origin,
    enabled=excluded.enabled,
    updated_at=now();

do $
declare
  v_secret text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='deploy-broker-control'
  ) then
    v_secret := encode(gen_random_bytes(32),'hex');
    select vault.create_secret(
      v_secret,
      'hercules-deploy-broker-control',
      'Hercules Deploy Broker internal service key'
    ) into v_secret_ref;

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'deploy-broker-control',
      encode(digest(v_secret,'sha256'),'hex'),
      true,
      now(),
      jsonb_build_object(
        'scope','deploy-broker-control',
        'credential_custody','supabase_vault',
        'carries_credentials',false,
        'version','v1'
      ),
      v_secret_ref
    );
    v_secret := null;
  end if;
end $;

create or replace function public.hercules_deploy_broker_submit(p_request jsonb)
returns bigint
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_ref uuid;
  v_key text;
  v_id bigint;
  v_action text;
  v_target text;
begin
  if jsonb_typeof(p_request) <> 'object' then raise exception 'deploy_broker_request_invalid'; end if;
  v_action := coalesce(p_request->>'action','');
  v_target := coalesce(p_request->>'target','');
  if v_action not in ('status','deploy','verify','rollback') then raise exception 'deploy_broker_action_denied'; end if;
  if v_target !~ '^[a-z0-9][a-z0-9-]{2,63}$' then raise exception 'deploy_broker_target_invalid'; end if;
  if p_request::text ~* '(password|secret|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token)' then
    raise exception 'deploy_broker_secret_shaped_input_denied';
  end if;

  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='deploy-broker-control' and enabled=true
  limit 1;
  if v_ref is null then raise exception 'deploy_broker_control_secret_missing'; end if;

  v_key := public.hercules_get_secret(v_ref);
  if v_key is null or length(v_key) < 32 then raise exception 'deploy_broker_control_secret_missing'; end if;

  select net.http_post(
    url:='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-deploy-broker',
    headers:=jsonb_build_object('content-type','application/json','x-hercules-internal-key',v_key),
    body:=p_request,
    timeout_milliseconds:=30000
  ) into v_id;

  v_key := null;
  return v_id;
end;
$$;

revoke all on function public.hercules_deploy_broker_submit(jsonb) from public, anon, authenticated;
grant execute on function public.hercules_deploy_broker_submit(jsonb) to service_role;
