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
  v_variant_sellability boolean;
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
  v_variant_count integer;
  v_sellable_count integer;
  v_continue_count integer;
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

  v_variant_count := coalesce((p_snapshot#>>'{product,variantsCount}')::integer,0);
  v_sellable_count := coalesce((p_snapshot#>>'{product,sellableVariantsCount}')::integer,0);
  v_continue_count := coalesce((p_snapshot#>>'{product,continueSellingVariantsCount}')::integer,0);

  v_product :=
    coalesce(p_snapshot#>>'{product,id}','')='gid://shopify/Product/10258238406976'
    and upper(coalesce(p_snapshot#>>'{product,status}',''))='ACTIVE'
    and lower(coalesce(p_snapshot#>>'{product,vendor}',''))='printify'
    and v_variant_count >= 29
    and coalesce((p_snapshot#>>'{product,mediaCount}')::integer,0) >= 16
    and coalesce(p_snapshot#>>'{product,onlineStoreUrl}','') ~ '^https://';

  v_variant_sellability :=
    v_variant_count >= 29
    and v_sellable_count = v_variant_count
    and v_continue_count = v_variant_count;

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
    and v_variant_sellability
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
    'variantSellability',v_variant_sellability,
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
  from public,anon,authenticated;
grant execute on function public.hercules_shopify_launch_readiness_observe(jsonb,text)
  to service_role;

comment on function public.hercules_shopify_launch_readiness_observe(jsonb,text) is
  'Service-role-only SauceApproved launch evaluator. Requires all anchor-product variants to be available for sale and configured to continue selling for the Printify zero-inventory model.';
