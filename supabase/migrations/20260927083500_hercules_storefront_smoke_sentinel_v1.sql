create or replace function public.hercules_storefront_smoke_submit()
returns bigint
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_url text;
  v_host text;
  v_request_id bigint;
begin
  if exists (
    select 1
    from public.hercules_browser_agent_runs
    where requested_by='hercules-storefront-smoke'
      and status='running'
      and created_at > now() - interval '10 minutes'
  ) then
    return null;
  end if;

  select nullif(snapshot#>>'{product,onlineStoreUrl}','')
    into v_url
    from public.hercules_shopify_launch_readiness
    where singleton=true;

  if exists (
    select 1
    from public.hercules_shopify_domain_cutover
    where singleton=true
      and stage='complete'
      and intended_domain_present
      and intended_domain_ssl_enabled
      and lower(coalesce(current_primary_host,''))='sauceapproved.com'
  ) then
    v_url := 'https://sauceapproved.com/products/sauceapproved-premium-hoodie';
  end if;

  if v_url is null or v_url !~* '^https://(sauceapproved-2\.myshopify\.com|sauceapproved\.com)/products/sauceapproved-premium-hoodie$' then
    raise exception 'storefront_smoke_target_unavailable';
  end if;

  v_host := lower(split_part(split_part(v_url,'://',2),'/',1));

  v_request_id := public.hercules_browser_agent_submit(
    v_url,
    'Verify the production hoodie storefront page is publicly reachable. Return the page title, whether the SauceApproved hoodie product is visible, whether size or color variant controls are visible, and whether an add-to-cart or purchase control is present. Do not add anything to cart and do not change state.',
    array[v_host],
    4,
    '{}'::jsonb,
    'hercules-storefront-smoke'
  );

  return v_request_id;
end;
$$;

revoke all on function public.hercules_storefront_smoke_submit()
  from public,anon,authenticated;
grant execute on function public.hercules_storefront_smoke_submit()
  to service_role;

create or replace function public.hercules_storefront_smoke_status()
returns jsonb
language sql
security definer
set search_path=public
as $$
  with latest as (
    select
      run_id,
      status,
      start_url,
      result,
      error,
      created_at,
      completed_at,
      updated_at
    from public.hercules_browser_agent_runs
    where requested_by='hercules-storefront-smoke'
    order by created_at desc
    limit 1
  )
  select case
    when not exists(select 1 from latest) then
      jsonb_build_object(
        'healthy',false,
        'state','never_run',
        'fresh',false
      )
    else
      jsonb_build_object(
        'healthy',
          coalesce((select status='succeeded' from latest),false)
          and coalesce((select completed_at >= now()-interval '2 hours' from latest),false)
          and coalesce((select position('Publicly reachable: yes' in coalesce(result->>'answer',''))>0 from latest),false)
          and coalesce((select position('SauceApproved hoodie visible: yes' in coalesce(result->>'answer',''))>0 from latest),false)
          and coalesce((select position('Size/color variant controls visible: yes' in coalesce(result->>'answer',''))>0 from latest),false)
          and coalesce((select position('Add-to-cart or purchase control visible: yes' in coalesce(result->>'answer',''))>0 from latest),false),
        'state',(select status from latest),
        'fresh',coalesce((select completed_at >= now()-interval '2 hours' from latest),false),
        'runId',(select run_id from latest),
        'url',(select start_url from latest),
        'answer',(select result->>'answer' from latest),
        'convergence',(select result->>'convergence' from latest),
        'error',(select error from latest),
        'createdAt',(select created_at from latest),
        'completedAt',(select completed_at from latest),
        'updatedAt',(select updated_at from latest)
      )
  end;
$$;

revoke all on function public.hercules_storefront_smoke_status()
  from public,anon,authenticated;
grant execute on function public.hercules_storefront_smoke_status()
  to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='hercules-storefront-smoke'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'hercules-storefront-smoke',
    '17 * * * *',
    'select public.hercules_storefront_smoke_submit();'
  );
end
$$;

comment on function public.hercules_storefront_smoke_submit() is
  'Hourly read-only SauceApproved storefront smoke check through the owned Hercules Browser Agent. Uses current Shopify URL until verified custom-domain cutover is complete.';
comment on function public.hercules_storefront_smoke_status() is
  'Service-role-only storefront smoke health derived from the latest bounded Browser Agent run.';
