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
  elsif p_action = 'inspect_resend_mail' then
    v_edge_action := 'inspect_resend_mail_dns';
  elsif p_action = 'reconcile_resend_mail' then
    v_edge_action := 'reconcile_resend_mail_dns';
  else
    raise exception 'spaceship_dns_action_not_allowed';
  end if;

  if p_action in ('inspect','inspect_resend_mail') and p_replace_custom_conflicts then
    raise exception 'replace_flag_not_allowed_for_inspect';
  end if;

  select secret_ref
    into v_secret_ref
    from public.hercules_internal_service_keys
   where purpose='spaceship-dns'
     and enabled=true
   limit 1;

  if v_secret_ref is null then
    raise exception 'spaceship_dns_internal_secret_missing';
  end if;

  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key) < 32 then
    raise exception 'spaceship_dns_internal_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-hercules-internal-key',v_internal_key
    ),
    body := jsonb_build_object(
      'action',v_edge_action,
      'replaceCustomConflicts',coalesce(p_replace_custom_conflicts,false)
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

comment on function public.hercules_spaceship_dns_submit(text,boolean) is
  'Service-role-only async Spaceship DNS bridge supporting isolated Shopify and Resend business-email reconciliation lanes.';

create or replace function public.hercules_business_email_dns_autopilot_tick()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
  v_oauth_status text;
  v_ledger_status text;
  v_ledger_value jsonb;
  v_run record;
  v_submit_id bigint;
begin
  insert into public.hercules_continuity_ledger(
    key,category,status,value,provenance,verified_at,updated_at
  )
  values(
    'hercules-outbound-business-sender',
    'communications',
    'waiting_provider_authorization',
    jsonb_build_object(
      'address','aaron@sauceapproved.com',
      'displayName','Aaron McRae',
      'brand','SauceApproved / Hercules',
      'canonical',true,
      'personalGmailAllowedForNewProspecting',false,
      'preferredNoMonthlyFeeProvider','resend',
      'resendDomainId','9d9bf72b-4383-4aea-8748-233e05c7edd0',
      'dnsReady',false,
      'providerConnectionReady',false
    ),
    'Canonical Hercules business sender. DNS is applied through fail-closed Spaceship reconciliation and Resend remains separately verified.',
    v_now,
    v_now
  )
  on conflict(key) do nothing;

  select status,value
    into v_ledger_status,v_ledger_value
    from public.hercules_continuity_ledger
   where key='hercules-outbound-business-sender'
   for update;

  if v_ledger_status='ready'
     and coalesce((v_ledger_value->>'dnsReady')::boolean,false)
     and coalesce((v_ledger_value->>'providerConnectionReady')::boolean,false) then
    return jsonb_build_object('ok',true,'stage','ready','action','none');
  end if;

  select status into v_oauth_status
    from public.hercules_spaceship_mcp_oauth
   where singleton=true
   limit 1;

  if coalesce(v_oauth_status,'unconfigured') <> 'configured' then
    update public.hercules_continuity_ledger
       set status='waiting_provider_authorization',
           value=coalesce(value,'{}'::jsonb) || jsonb_build_object(
             'dnsReady',false,
             'providerConnectionReady',false,
             'lastEmailDnsTickAt',v_now
           ),
           provenance='Canonical Hercules business sender waiting on legitimate Spaceship provider authorization before mail DNS can be written.',
           verified_at=v_now,
           updated_at=v_now
     where key='hercules-outbound-business-sender';

    return jsonb_build_object(
      'ok',true,
      'stage','waiting_provider_authorization',
      'action','none'
    );
  end if;

  select trace_id,status,error,started_at,completed_at,summary
    into v_run
    from public.hercules_spaceship_dns_runs
   where action='reconcile_resend_mail_dns'
     and domain='sauceapproved.com'
   order by started_at desc
   limit 1;

  if found then
    if v_run.status='succeeded'
       and coalesce((v_run.summary->>'verified')::boolean,false) then
      update public.hercules_continuity_ledger
         set status='dns_verified_provider_pending',
             value=coalesce(value,'{}'::jsonb) || jsonb_build_object(
               'dnsReady',true,
               'providerConnectionReady',false,
               'lastEmailDnsVerifiedAt',coalesce(v_run.completed_at,v_now),
               'lastEmailDnsTraceId',v_run.trace_id,
               'lastEmailDnsTickAt',v_now
             ),
             provenance='Spaceship mail DNS reconciliation verified. Resend domain/provider verification is still required before the business sender is active.',
             verified_at=v_now,
             updated_at=v_now
       where key='hercules-outbound-business-sender';

      return jsonb_build_object(
        'ok',true,
        'stage','dns_verified_provider_pending',
        'action','verify_resend_domain',
        'traceId',v_run.trace_id
      );
    elsif v_run.status='running' and v_run.started_at > v_now - interval '10 minutes' then
      update public.hercules_continuity_ledger
         set status='dns_reconcile_running',
             value=coalesce(value,'{}'::jsonb) || jsonb_build_object(
               'lastEmailDnsTraceId',v_run.trace_id,
               'lastEmailDnsTickAt',v_now
             ),
             verified_at=v_now,
             updated_at=v_now
       where key='hercules-outbound-business-sender';

      return jsonb_build_object(
        'ok',true,
        'stage','dns_reconcile_running',
        'action','wait',
        'traceId',v_run.trace_id
      );
    elsif v_run.status in ('failed','conflict') then
      update public.hercules_continuity_ledger
         set status='dns_blocked',
             value=coalesce(value,'{}'::jsonb) || jsonb_build_object(
               'dnsReady',false,
               'providerConnectionReady',false,
               'lastEmailDnsTraceId',v_run.trace_id,
               'lastEmailDnsProviderStatus',v_run.status,
               'lastEmailDnsError',coalesce(v_run.error,'resend_mail_dns_blocked'),
               'lastEmailDnsTickAt',v_now
             ),
             provenance='Business-email DNS reconciliation stopped fail-closed because Spaceship reported a conflict or provider failure.',
             verified_at=v_now,
             updated_at=v_now
       where key='hercules-outbound-business-sender';

      return jsonb_build_object(
        'ok',false,
        'stage','dns_blocked',
        'action','none',
        'traceId',v_run.trace_id,
        'error',coalesce(v_run.error,'resend_mail_dns_blocked')
      );
    end if;
  end if;

  v_submit_id := public.hercules_spaceship_dns_submit('reconcile_resend_mail', false);

  update public.hercules_continuity_ledger
     set status='dns_reconcile_queued',
         value=coalesce(value,'{}'::jsonb) || jsonb_build_object(
           'dnsReady',false,
           'providerConnectionReady',false,
           'lastEmailDnsRequestId',v_submit_id,
           'lastEmailDnsTickAt',v_now
         ),
         provenance='Spaceship is authorized; Hercules queued fail-closed Resend mail DNS reconciliation without replacing custom conflicts.',
         verified_at=v_now,
         updated_at=v_now
   where key='hercules-outbound-business-sender';

  return jsonb_build_object(
    'ok',true,
    'stage','dns_reconcile_queued',
    'action','provider_reconcile_queued',
    'requestId',v_submit_id
  );
end;
$$;

revoke all on function public.hercules_business_email_dns_autopilot_tick()
  from public, anon, authenticated;
grant execute on function public.hercules_business_email_dns_autopilot_tick() to service_role;

comment on function public.hercules_business_email_dns_autopilot_tick() is
  'Fail-closed business-email DNS autopilot. Waits for Spaceship authorization, queues non-destructive Resend DNS reconciliation, and never claims provider activation before independent Resend verification.';

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
    from cron.job
   where jobname='hercules-business-email-dns-autopilot'
   limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'hercules-business-email-dns-autopilot',
    '*/5 * * * *',
    'select public.hercules_business_email_dns_autopilot_tick();'
  );
end
$$;
