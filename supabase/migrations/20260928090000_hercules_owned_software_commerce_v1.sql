-- Hercules owned software commerce shell v1
-- SauceApproved Studio + SauceApproved Ads
-- Hard invariant: owned backend-autonomous deployment lane only.

create or replace function public.hercules_select_deployment_target(p_artifact_kind text)
returns table(
  provider text,
  target text,
  autonomous boolean,
  live_verification_supported boolean,
  rendered_web boolean,
  status text,
  execution_mode text,
  notes text
)
language sql
stable
set search_path to 'public'
as $function$
  select c.provider,c.target,c.autonomous,c.live_verification_supported,
         c.rendered_web,c.status,c.execution_mode,c.notes
  from public.hercules_deployment_capabilities c
  where c.artifact_kind=p_artifact_kind
    and c.status='available'
    and c.live_verification_supported=true
    and c.autonomous=true
    and c.execution_mode='backend_autonomous'
  order by
    case when c.provider='supabase' then 0 else 1 end,
    c.provider,c.target
  limit 1
$function$;

create or replace function public.hercules_ad_studio_deploy_tick()
returns bigint
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_ref uuid;
  v_secret text;
  v_request bigint;
begin
  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='deploy-controller' and enabled=true
  limit 1;

  if v_ref is null then
    raise exception 'deploy_controller_secret_missing';
  end if;

  v_secret:=public.hercules_get_secret(v_ref);

  select net.http_post(
    url:='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-deploy-controller',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-hercules-internal-key',v_secret
    ),
    body:='{"action":"deploy_canonical_ad_studio"}'::jsonb,
    timeout_milliseconds:=30000
  ) into v_request;

  return v_request;
end;
$function$;

create or replace function public.hercules_owned_static_publish_tick(p_slug text, p_html text)
returns bigint
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_ref uuid;
  v_secret text;
  v_request bigint;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'invalid_slug';
  end if;
  if p_html is null or length(p_html)<500 or length(p_html)>500000 then
    raise exception 'invalid_html';
  end if;

  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='deploy-controller' and enabled=true
  limit 1;

  if v_ref is null then
    raise exception 'deploy_controller_secret_missing';
  end if;

  v_secret:=public.hercules_get_secret(v_ref);

  select net.http_post(
    url:='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-deploy-controller',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-hercules-internal-key',v_secret
    ),
    body:=jsonb_build_object('action','deploy_static','slug',p_slug,'html',p_html),
    timeout_milliseconds:=45000
  ) into v_request;

  return v_request;
end;
$function$;

revoke all on function public.hercules_ad_studio_deploy_tick() from public, anon, authenticated;
revoke all on function public.hercules_owned_static_publish_tick(text,text) from public, anon, authenticated;
revoke all on function public.hercules_studio_forge_build_tick() from public, anon, authenticated;

create table if not exists public.hercules_software_products (
  code text primary key,
  name text not null,
  descriptor text not null,
  status text not null default 'early_access'
    check (status in ('draft','early_access','active','paused','retired')),
  live_url text,
  checkout_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hercules_software_product_plans (
  product_code text not null references public.hercules_software_products(code) on delete cascade,
  plan_code text not null,
  label text not null,
  candidate_monthly_price_cents integer not null check (candidate_monthly_price_cents >= 0),
  pricing_status text not null default 'owner_approval_required'
    check (pricing_status in ('owner_approval_required','approved','retired')),
  checkout_enabled boolean not null default false,
  entitlements jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (product_code,plan_code)
);

create table if not exists public.hercules_software_access_requests (
  id uuid primary key default gen_random_uuid(),
  product_code text not null,
  plan_code text not null,
  email text not null,
  full_name text,
  company text,
  role text,
  message text,
  source text not null default 'direct',
  medium text not null default 'web',
  campaign text not null default 'software-founding-access-v1',
  content text,
  attribution_id text,
  status text not null default 'new'
    check (status in ('new','reviewing','qualified','invited','converted','closed','suppressed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_code,plan_code)
    references public.hercules_software_product_plans(product_code,plan_code)
);

alter table public.hercules_software_products enable row level security;
alter table public.hercules_software_product_plans enable row level security;
alter table public.hercules_software_access_requests enable row level security;

revoke all on public.hercules_software_products from anon, authenticated;
revoke all on public.hercules_software_product_plans from anon, authenticated;
revoke all on public.hercules_software_access_requests from anon, authenticated;

insert into public.hercules_software_products(code,name,descriptor,status,live_url,checkout_enabled,metadata)
values
('sauceapproved-studio','SauceApproved Studio','AI Video Maker','early_access','https://sauceapproved-forge-host.onrender.com/sauceapproved-studio/',false,
 '{"owned_lane":true,"commercial_mode":"founding_access","canonical_core":"hercules-video/"}'::jsonb),
('sauceapproved-ads','SauceApproved Ads','AI Ad Maker','early_access','https://sauceapproved-forge-host.onrender.com/sauceapproved-ads/',false,
 '{"owned_lane":true,"commercial_mode":"founding_access","canonical_core":"hercules-forge/ad-studio/index.html"}'::jsonb)
on conflict (code) do update set
  name=excluded.name,
  descriptor=excluded.descriptor,
  status=excluded.status,
  live_url=excluded.live_url,
  checkout_enabled=false,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.hercules_software_product_plans(product_code,plan_code,label,candidate_monthly_price_cents,pricing_status,checkout_enabled,entitlements)
values
('sauceapproved-studio','starter','Starter',2900,'owner_approval_required',false,'["video_projects","storyboard_generation","quality_gated_exports","provenance_manifest"]'::jsonb),
('sauceapproved-studio','pro','Pro',7900,'owner_approval_required',false,'["starter_features","campaign_workspaces","multi_scene_assembly","brand_presets","priority_render_queue_policy"]'::jsonb),
('sauceapproved-studio','agency','Agency',19900,'owner_approval_required',false,'["pro_features","multi_brand_workspaces","team_roles","client_export_packages","higher_usage_policy"]'::jsonb),
('sauceapproved-ads','starter','Starter',2900,'owner_approval_required',false,'["campaign_workspaces","message_angle_generation","creative_exports","utm_builder","manual_performance_ledger"]'::jsonb),
('sauceapproved-ads','pro','Pro',7900,'owner_approval_required',false,'["starter_features","brand_presets","campaign_variants","export_packages","higher_campaign_limits"]'::jsonb),
('sauceapproved-ads','agency','Agency',19900,'owner_approval_required',false,'["pro_features","multi_brand_workspaces","team_roles","client_campaign_packages","higher_usage_policy"]'::jsonb)
on conflict (product_code,plan_code) do update set
  label=excluded.label,
  candidate_monthly_price_cents=excluded.candidate_monthly_price_cents,
  pricing_status='owner_approval_required',
  checkout_enabled=false,
  entitlements=excluded.entitlements,
  updated_at=now();

create or replace function public.hercules_public_software_catalog()
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
  select jsonb_build_object(
    'products',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'code',p.code,
        'name',p.name,
        'descriptor',p.descriptor,
        'status',p.status,
        'live_url',p.live_url,
        'checkout_enabled',p.checkout_enabled,
        'plans',(
          select coalesce(jsonb_agg(jsonb_build_object(
            'plan_code',pl.plan_code,
            'label',pl.label,
            'candidate_monthly_price_cents',pl.candidate_monthly_price_cents,
            'pricing_status',pl.pricing_status,
            'checkout_enabled',pl.checkout_enabled,
            'entitlements',pl.entitlements
          ) order by pl.candidate_monthly_price_cents),'[]'::jsonb)
          from public.hercules_software_product_plans pl
          where pl.product_code=p.code
        )
      ) order by p.name
    ),'[]'::jsonb)
  )
  from public.hercules_software_products p
  where p.status in ('early_access','active')
$function$;

create or replace function public.hercules_request_software_access(
  p_product_code text,
  p_plan_code text,
  p_email text,
  p_full_name text default null,
  p_company text default null,
  p_role text default null,
  p_message text default null,
  p_website text default null,
  p_attribution jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_product public.hercules_software_products%rowtype;
  v_plan public.hercules_software_product_plans%rowtype;
  v_email text := lower(trim(coalesce(p_email,'')));
  v_recent integer;
  v_id uuid;
begin
  if length(trim(coalesce(p_website,''))) > 0 then
    return jsonb_build_object('ok',true,'accepted',true);
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 then
    raise exception 'invalid_email';
  end if;

  select * into v_product
  from public.hercules_software_products
  where code=p_product_code and status in ('early_access','active');
  if not found then raise exception 'product_unavailable'; end if;

  select * into v_plan
  from public.hercules_software_product_plans
  where product_code=p_product_code and plan_code=p_plan_code
    and pricing_status in ('owner_approval_required','approved');
  if not found then raise exception 'plan_unavailable'; end if;

  select count(*) into v_recent
  from public.hercules_software_access_requests
  where email=v_email and product_code=p_product_code
    and created_at >= now()-interval '24 hours';
  if v_recent >= 3 then raise exception 'request_rate_limited'; end if;

  insert into public.hercules_software_access_requests(
    product_code,plan_code,email,full_name,company,role,message,
    source,medium,campaign,content,attribution_id,metadata
  )
  values(
    p_product_code,p_plan_code,v_email,
    nullif(left(trim(coalesce(p_full_name,'')),100),''),
    nullif(left(trim(coalesce(p_company,'')),160),''),
    nullif(left(trim(coalesce(p_role,'')),100),''),
    nullif(left(trim(coalesce(p_message,'')),1200),''),
    left(coalesce(p_attribution->>'source','direct'),100),
    left(coalesce(p_attribution->>'medium','web'),100),
    left(coalesce(p_attribution->>'campaign','software-founding-access-v1'),120),
    left(coalesce(p_attribution->>'content',p_product_code),120),
    left(coalesce(p_attribution->>'attribution_id',''),120),
    jsonb_build_object(
      'pricing_status',v_plan.pricing_status,
      'checkout_enabled',v_plan.checkout_enabled,
      'commercial_mode','founding_access'
    )
  )
  returning id into v_id;

  return jsonb_build_object('ok',true,'accepted',true,'request_id',v_id);
end;
$function$;

revoke all on function public.hercules_public_software_catalog() from public;
revoke all on function public.hercules_request_software_access(text,text,text,text,text,text,text,text,jsonb) from public;
grant execute on function public.hercules_public_software_catalog() to anon, authenticated;
grant execute on function public.hercules_request_software_access(text,text,text,text,text,text,text,text,jsonb) to anon, authenticated;
