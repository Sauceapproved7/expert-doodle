do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='shopify-domain-monitor'
  ) then
    v_internal_key := encode(extensions.gen_random_bytes(32),'hex');
    v_secret_ref := public.hercules_store_secret(
      v_internal_key,
      'hercules-shopify-domain-monitor-internal',
      'Internal authentication key for scheduled Shopify domain observation.'
    );

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'shopify-domain-monitor',
      encode(extensions.digest(v_internal_key,'sha256'),'hex'),
      true,
      now(),
      '{"scope":"shopify-domain-monitor","owner":"Hercules","credentialType":"internal-control"}'::jsonb,
      v_secret_ref
    );

    v_internal_key := null;
  end if;
end
$$;

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
      and account_key='azymhc-x0.myshopify.com'
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

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='hercules-shopify-domain-monitor'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'hercules-shopify-domain-monitor',
    '*/5 * * * *',
    'select public.hercules_shopify_domain_monitor_submit();'
  );
end
$$;

comment on function public.hercules_shopify_domain_monitor_submit() is
  'Five-minute server-side Shopify domain monitor. Makes no provider request until the first-party Shopify connection is active and registrar DNS has reached shopify_attach_pending.';
