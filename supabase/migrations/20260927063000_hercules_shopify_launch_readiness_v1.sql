create table if not exists public.hercules_shopify_launch_readiness (
  singleton boolean primary key default true check (singleton),
  stage text not null default 'unknown'
    check (stage in ('unknown','blocked_storefront','ready_except_domain','ready')),
  shop_gid text not null default 'gid://shopify/Shop/100002726208'
    check (shop_gid='gid://shopify/Shop/100002726208'),
  gates jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  source text,
  last_error text,
  last_observed_at timestamptz,
  last_transition_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hercules_shopify_launch_readiness enable row level security;
alter table public.hercules_shopify_launch_readiness force row level security;
revoke all on table public.hercules_shopify_launch_readiness from public, anon, authenticated;
grant select, insert, update on table public.hercules_shopify_launch_readiness to service_role;

insert into public.hercules_shopify_launch_readiness(singleton)
values(true)
on conflict(singleton) do nothing;

create or replace function public.hercules_shopify_launch_readiness_observe(
  p_snapshot jsonb,
  p_source text default 'shopify-admin-graphql'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := now();
  v_current_stage text;
  v_stage text;
  v_shop_gid text;
  v_identity boolean;
  v_paid_plan boolean;
  v_theme boolean;
  v_product boolean;
  v_online_store boolean;
  v_shop_channel boolean;
  v_google_youtube boolean;
  v_launch_drop boolean;
  v_hoodies boolean;
  v_apparel boolean;
  v_main_menu boolean;
  v_footer_menu boolean;
  v_storefront_ready boolean;
  v_domain_complete boolean;
  v_gates jsonb;
begin
  if p_snapshot is null
     or jsonb_typeof(p_snapshot) <> 'object'
     or length(p_snapshot::text) > 131072 then
    raise exception 'shopify_launch_snapshot_invalid';
  end if;

  v_shop_gid := trim(coalesce(p_snapshot->>'shopGid',''));
  if v_shop_gid <> 'gid://shopify/Shop/100002726208' then
    raise exception 'shopify_launch_shop_gid_mismatch';
  end if;

  v_identity := true;

  v_paid_plan :=
    coalesce((p_snapshot#>>'{plan,partnerDevelopment}')::boolean,true)=false
    and length(trim(coalesce(p_snapshot#>>'{plan,publicDisplayName}','')))>0;

  v_theme :=
    upper(coalesce(p_snapshot#>>'{theme,role}',''))='MAIN'
    and coalesce((p_snapshot#>>'{theme,processing}')::boolean,true)=false
    and coalesce((p_snapshot#>>'{theme,processingFailed}')::boolean,true)=false
    and length(trim(coalesce(p_snapshot#>>'{theme,id}','')))>0;

  v_product :=
    coalesce(p_snapshot#>>'{product,id}','')='gid://shopify/Product/10258238406976'
    and upper(coalesce(p_snapshot#>>'{product,status}',''))='ACTIVE'
    and lower(coalesce(p_snapshot#>>'{product,vendor}',''))='printify'
    and coalesce((p_snapshot#>>'{product,variantsCount}')::integer,0) >= 29
    and coalesce((p_snapshot#>>'{product,mediaCount}')::integer,0) >= 16
    and coalesce(p_snapshot#>>'{product,onlineStoreUrl}','') ~ '^https://';

  v_online_store := coalesce((p_snapshot#>>'{channels,onlineStore}')::boolean,false);
  v_shop_channel := coalesce((p_snapshot#>>'{channels,shop}')::boolean,false);
  v_google_youtube := coalesce((p_snapshot#>>'{channels,googleYoutube}')::boolean,false);

  v_launch_drop :=
    coalesce((p_snapshot#>>'{collections,launchDrop,productsCount}')::integer,0)>0
    and coalesce((p_snapshot#>>'{collections,launchDrop,publicationsCount}')::integer,0)>0;

  v_hoodies :=
    coalesce((p_snapshot#>>'{collections,hoodies,productsCount}')::integer,0)>0
    and coalesce((p_snapshot#>>'{collections,hoodies,publicationsCount}')::integer,0)>0;

  v_apparel :=
    coalesce((p_snapshot#>>'{collections,apparel,productsCount}')::integer,0)>0
    and coalesce((p_snapshot#>>'{collections,apparel,publicationsCount}')::integer,0)>0;

  v_main_menu :=
    coalesce((p_snapshot#>>'{menus,main,isDefault}')::boolean,false)
    and coalesce(p_snapshot#>'{menus,main,items}','[]'::jsonb) ? 'Home'
    and coalesce(p_snapshot#>'{menus,main,items}','[]'::jsonb) ? 'Shop'
    and coalesce(p_snapshot#>'{menus,main,items}','[]'::jsonb) ? 'Apps'
    and coalesce(p_snapshot#>'{menus,main,items}','[]'::jsonb) ? 'Contact';

  v_footer_menu :=
    coalesce((p_snapshot#>>'{menus,footer,isDefault}')::boolean,false)
    and coalesce(p_snapshot#>'{menus,footer,items}','[]'::jsonb) ? 'Privacy Policy'
    and coalesce(p_snapshot#>'{menus,footer,items}','[]'::jsonb) ? 'Contact';

  select coalesce(
    stage='complete'
    and intended_domain_present
    and intended_domain_ssl_enabled
    and lower(coalesce(current_primary_host,''))='sauceapproved.com',
    false
  )
  into v_domain_complete
  from public.hercules_shopify_domain_cutover
  where singleton=true;

  v_domain_complete := coalesce(v_domain_complete,false);

  v_storefront_ready :=
    v_identity
    and v_paid_plan
    and v_theme
    and v_product
    and v_online_store
    and v_shop_channel
    and v_launch_drop
    and v_hoodies
    and v_apparel
    and v_main_menu
    and v_footer_menu;

  if v_storefront_ready and v_domain_complete then
    v_stage := 'ready';
  elsif v_storefront_ready then
    v_stage := 'ready_except_domain';
  else
    v_stage := 'blocked_storefront';
  end if;

  v_gates := jsonb_build_object(
    'identity',v_identity,
    'paidPlan',v_paid_plan,
    'mainTheme',v_theme,
    'anchorProduct',v_product,
    'onlineStorePublication',v_online_store,
    'shopPublication',v_shop_channel,
    'googleYoutubePublication',v_google_youtube,
    'launchDropCollection',v_launch_drop,
    'hoodiesCollection',v_hoodies,
    'apparelCollection',v_apparel,
    'mainMenu',v_main_menu,
    'footerMenu',v_footer_menu,
    'domainComplete',v_domain_complete,
    'storefrontReady',v_storefront_ready
  );

  select stage into v_current_stage
  from public.hercules_shopify_launch_readiness
  where singleton=true
  for update;

  update public.hercules_shopify_launch_readiness
  set stage=v_stage,
      gates=v_gates,
      snapshot=p_snapshot,
      source=left(coalesce(nullif(trim(p_source),''),'shopify-admin-graphql'),120),
      last_error=null,
      last_observed_at=v_now,
      last_transition_at=case when v_current_stage is distinct from v_stage then v_now else last_transition_at end,
      updated_at=v_now
  where singleton=true;

  return jsonb_build_object(
    'ok',true,
    'stage',v_stage,
    'gates',v_gates,
    'observedAt',v_now
  );
end;
$$;

revoke all on function public.hercules_shopify_launch_readiness_observe(jsonb,text)
  from public, anon, authenticated;
grant execute on function public.hercules_shopify_launch_readiness_observe(jsonb,text)
  to service_role;

create or replace function public.hercules_shopify_launch_readiness_status()
returns jsonb
language sql
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'readiness',to_jsonb(r),
    'domainCutover',coalesce((
      select to_jsonb(c)
      from public.hercules_shopify_domain_cutover c
      where c.singleton=true
    ),'{}'::jsonb),
    'domainLaunch',coalesce((
      select to_jsonb(a)
      from public.hercules_domain_launch_autopilot a
      where a.singleton=true
    ),'{}'::jsonb)
  )
  from public.hercules_shopify_launch_readiness r
  where r.singleton=true;
$$;

revoke all on function public.hercules_shopify_launch_readiness_status()
  from public, anon, authenticated;
grant execute on function public.hercules_shopify_launch_readiness_status()
  to service_role;

do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='shopify-launch-readiness'
  ) then
    v_internal_key := encode(extensions.gen_random_bytes(32),'hex');
    v_secret_ref := public.hercules_store_secret(
      v_internal_key,
      'hercules-shopify-launch-readiness-internal',
      'Internal authentication key for scheduled Shopify launch-readiness observation.'
    );

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'shopify-launch-readiness',
      encode(extensions.digest(v_internal_key,'sha256'),'hex'),
      true,
      now(),
      '{"scope":"shopify-launch-readiness","owner":"Hercules","credentialType":"internal-control"}'::jsonb,
      v_secret_ref
    );

    v_internal_key := null;
  end if;
end
$$;

create or replace function public.hercules_shopify_launch_readiness_submit()
returns bigint
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_secret_ref uuid;
  v_internal_key text;
  v_request_id bigint;
begin
  if not exists (
    select 1
    from public.hercules_provider_connections
    where provider='shopify'
      and account_key='azymhc-x0.myshopify.com'
      and status='active'
      and access_secret_ref is not null
  ) then
    return null;
  end if;

  select secret_ref into v_secret_ref
  from public.hercules_internal_service_keys
  where purpose='shopify-launch-readiness'
    and enabled=true
  limit 1;

  if v_secret_ref is null then
    raise exception 'shopify_launch_readiness_internal_secret_missing';
  end if;

  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key)<32 then
    raise exception 'shopify_launch_readiness_internal_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-provider-connect',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-hercules-internal-key',v_internal_key
    ),
    body := '{"action":"monitor_shopify_launch"}'::jsonb,
    timeout_milliseconds := 65000
  ) into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_shopify_launch_readiness_submit()
  from public,anon,authenticated;
grant execute on function public.hercules_shopify_launch_readiness_submit()
  to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='hercules-shopify-launch-readiness'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'hercules-shopify-launch-readiness',
    '*/15 * * * *',
    'select public.hercules_shopify_launch_readiness_submit();'
  );
end
$$;

comment on table public.hercules_shopify_launch_readiness is
  'Sanitized SauceApproved Shopify launch-readiness state. No Shopify credential values are stored.';
comment on function public.hercules_shopify_launch_readiness_observe(jsonb,text) is
  'Service-role-only evaluator for verified Shopify storefront readiness, with custom-domain completion as the final gate.';
comment on function public.hercules_shopify_launch_readiness_submit() is
  'Fifteen-minute first-party Shopify readiness monitor submitter. It stays idle until a Vault-backed Shopify provider connection is active.';
