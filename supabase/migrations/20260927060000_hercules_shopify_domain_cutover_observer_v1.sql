create table if not exists public.hercules_shopify_domain_cutover (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  shop_gid text not null default 'gid://shopify/Shop/100002726208'
    check (shop_gid='gid://shopify/Shop/100002726208'),
  intended_domain text not null default 'sauceapproved.com'
    check (intended_domain='sauceapproved.com'),
  stage text not null default 'waiting_dns'
    check (stage in (
      'waiting_dns',
      'awaiting_attachment',
      'awaiting_ssl',
      'ready_for_primary',
      'complete',
      'blocked'
    )),
  current_primary_host text,
  current_primary_domain_id text,
  current_primary_ssl_enabled boolean,
  intended_domain_id text,
  intended_domain_present boolean not null default false,
  intended_domain_ssl_enabled boolean not null default false,
  last_observed_at timestamptz,
  last_observation_source text,
  observation jsonb not null default '{}'::jsonb,
  last_error text,
  last_transition_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hercules_shopify_domain_cutover enable row level security;
alter table public.hercules_shopify_domain_cutover force row level security;
revoke all on table public.hercules_shopify_domain_cutover from public, anon, authenticated;
grant select, insert, update on table public.hercules_shopify_domain_cutover to service_role;

insert into public.hercules_shopify_domain_cutover(singleton)
values(true)
on conflict(singleton) do nothing;

create or replace function public.hercules_shopify_domain_observe(
  p_shop_gid text,
  p_primary_domain_id text,
  p_primary_host text,
  p_primary_ssl_enabled boolean,
  p_domains jsonb,
  p_source text default 'shopify-admin-graphql'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := now();
  v_launch_stage text;
  v_domain record;
  v_intended_present boolean := false;
  v_intended_ssl boolean := false;
  v_intended_id text := null;
  v_stage text;
  v_domain_count integer;
  v_item jsonb;
  v_host text;
  v_id text;
  v_ssl boolean;
  v_current_stage text;
begin
  if p_shop_gid <> 'gid://shopify/Shop/100002726208' then
    raise exception 'shopify_shop_gid_mismatch';
  end if;

  if p_primary_host is null
     or lower(trim(p_primary_host)) !~ '^[a-z0-9.-]+$'
     or length(p_primary_host) > 253 then
    raise exception 'shopify_primary_host_invalid';
  end if;

  if p_primary_domain_id is null or length(trim(p_primary_domain_id)) > 256 then
    raise exception 'shopify_primary_domain_id_invalid';
  end if;

  if p_domains is null or jsonb_typeof(p_domains) <> 'array' then
    raise exception 'shopify_domains_array_required';
  end if;

  v_domain_count := jsonb_array_length(p_domains);
  if v_domain_count < 1 or v_domain_count > 50 then
    raise exception 'shopify_domain_count_out_of_range';
  end if;

  for v_item in select value from jsonb_array_elements(p_domains)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'shopify_domain_item_invalid';
    end if;

    v_host := lower(trim(coalesce(v_item->>'host','')));
    v_id := trim(coalesce(v_item->>'id',''));
    v_ssl := coalesce((v_item->>'sslEnabled')::boolean,false);

    if v_host = ''
       or v_host !~ '^[a-z0-9.-]+$'
       or length(v_host) > 253
       or v_id = ''
       or length(v_id) > 256 then
      raise exception 'shopify_domain_item_invalid';
    end if;

    if v_host = 'sauceapproved.com' then
      v_intended_present := true;
      v_intended_ssl := v_ssl;
      v_intended_id := v_id;
    end if;
  end loop;

  select stage into v_launch_stage
  from public.hercules_domain_launch_autopilot
  where singleton=true;

  select stage into v_current_stage
  from public.hercules_shopify_domain_cutover
  where singleton=true
  for update;

  if lower(trim(p_primary_host))='sauceapproved.com' then
    if not v_intended_present or not v_intended_ssl or p_primary_ssl_enabled is not true then
      v_stage := 'blocked';
    else
      v_stage := 'complete';
    end if;
  elsif v_intended_present and v_intended_ssl then
    v_stage := 'ready_for_primary';
  elsif v_intended_present then
    v_stage := 'awaiting_ssl';
  elsif v_launch_stage='shopify_attach_pending' then
    v_stage := 'awaiting_attachment';
  else
    v_stage := 'waiting_dns';
  end if;

  update public.hercules_shopify_domain_cutover
  set stage=v_stage,
      current_primary_host=lower(trim(p_primary_host)),
      current_primary_domain_id=trim(p_primary_domain_id),
      current_primary_ssl_enabled=coalesce(p_primary_ssl_enabled,false),
      intended_domain_id=v_intended_id,
      intended_domain_present=v_intended_present,
      intended_domain_ssl_enabled=v_intended_ssl,
      last_observed_at=v_now,
      last_observation_source=left(coalesce(nullif(trim(p_source),''),'shopify-admin-graphql'),120),
      observation=jsonb_build_object(
        'shopGid',p_shop_gid,
        'primary',jsonb_build_object(
          'id',trim(p_primary_domain_id),
          'host',lower(trim(p_primary_host)),
          'sslEnabled',coalesce(p_primary_ssl_enabled,false)
        ),
        'domains',p_domains
      ),
      last_error=case
        when v_stage='blocked' then 'shopify_primary_domain_inconsistent'
        else null
      end,
      last_transition_at=case when v_current_stage is distinct from v_stage then v_now else last_transition_at end,
      updated_at=v_now
  where singleton=true;

  if v_stage='complete' then
    update public.hercules_domains
    set status='active',
        verified_at=coalesce(verified_at,v_now),
        ssl_status='active',
        metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'shopify_custom_domain_id',v_intended_id,
          'shopify_custom_domain_ssl_enabled',true,
          'shopify_custom_domain_primary',true,
          'shopify_custom_domain_completed_at',v_now,
          'shopify_domain_cutover_observer','v1'
        ),
        updated_at=v_now
    where domain_name='sauceapproved.com'
      and status <> 'removed';

    update public.hercules_domain_launch_autopilot
    set stage='complete',
        last_error=null,
        last_transition_at=case when stage<>'complete' then v_now else last_transition_at end,
        metadata=metadata || jsonb_build_object(
          'shopifyPrimaryDomain','sauceapproved.com',
          'shopifyDomainId',v_intended_id,
          'shopifySslEnabled',true,
          'completedAt',v_now
        ),
        updated_at=v_now
    where singleton=true;
  end if;

  return jsonb_build_object(
    'ok',v_stage<>'blocked',
    'stage',v_stage,
    'launchStage',v_launch_stage,
    'shopGid',p_shop_gid,
    'primaryHost',lower(trim(p_primary_host)),
    'primarySslEnabled',coalesce(p_primary_ssl_enabled,false),
    'intendedDomainPresent',v_intended_present,
    'intendedDomainId',v_intended_id,
    'intendedDomainSslEnabled',v_intended_ssl,
    'observedAt',v_now
  );
end;
$$;

revoke all on function public.hercules_shopify_domain_observe(text,text,text,boolean,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.hercules_shopify_domain_observe(text,text,text,boolean,jsonb,text)
  to service_role;

create or replace function public.hercules_shopify_domain_cutover_status()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'cutover',to_jsonb(c),
    'launch',coalesce((
      select to_jsonb(a)
      from public.hercules_domain_launch_autopilot a
      where a.singleton=true
    ),'{}'::jsonb),
    'domain',coalesce((
      select to_jsonb(d)
      from public.hercules_domains d
      where d.domain_name='sauceapproved.com'
        and d.status<>'removed'
      order by d.created_at desc
      limit 1
    ),'{}'::jsonb)
  )
  from public.hercules_shopify_domain_cutover c
  where c.singleton=true;
$$;

revoke all on function public.hercules_shopify_domain_cutover_status()
  from public, anon, authenticated;
grant execute on function public.hercules_shopify_domain_cutover_status()
  to service_role;

comment on table public.hercules_shopify_domain_cutover is
  'Sanitized Shopify custom-domain cutover state for SauceApproved. Contains no Shopify access tokens.';
comment on function public.hercules_shopify_domain_observe(text,text,text,boolean,jsonb,text) is
  'Service-role-only ingestion of a verified Shopify Admin domain snapshot. Advances the cutover state without exposing Shopify credentials.';
comment on function public.hercules_shopify_domain_cutover_status() is
  'Service-role-only readout of Shopify cutover, DNS launch, and production-domain state.';
