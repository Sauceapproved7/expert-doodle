-- Align scheduled Shopify monitors with the canonical live SauceApproved shop domain.
-- The Shop GID remains the immutable store identity; this patch updates provider account-key lookups.

create or replace function public.hercules_shopify_domain_monitor_submit()
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
      and account_key='sauceapproved-2.myshopify.com'
      and status='active'
      and access_secret_ref is not null
  ) then
    return null;
  end if;

  if not exists (
    select 1
    from public.hercules_domain_launch_autopilot
    where singleton=true
      and stage='shopify_attach_pending'
  ) then
    return null;
  end if;

  if exists (
    select 1
    from public.hercules_shopify_domain_cutover
    where singleton=true
      and stage='complete'
  ) then
    return null;
  end if;

  select secret_ref into v_secret_ref
  from public.hercules_internal_service_keys
  where purpose='shopify-domain-monitor'
    and enabled=true
  limit 1;

  if v_secret_ref is null then
    raise exception 'shopify_domain_monitor_internal_secret_missing';
  end if;

  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key)<32 then
    raise exception 'shopify_domain_monitor_internal_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-provider-connect',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-hercules-internal-key',v_internal_key
    ),
    body := '{"action":"monitor_shopify_domain"}'::jsonb,
    timeout_milliseconds := 65000
  ) into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_shopify_domain_monitor_submit()
  from public,anon,authenticated;
grant execute on function public.hercules_shopify_domain_monitor_submit()
  to service_role;

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
      and account_key='sauceapproved-2.myshopify.com'
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
