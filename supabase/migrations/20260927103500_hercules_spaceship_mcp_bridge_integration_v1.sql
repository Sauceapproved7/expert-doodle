update public.hercules_spaceship_mcp_oauth
set redirect_uri='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge?spaceship_mcp_oauth_callback=1',
    updated_at=now()
where singleton=true;

create or replace function public.hercules_spaceship_mcp_store_registration(
  p_client_id text,
  p_client_secret text,
  p_redirect_uri text
)
returns boolean
language plpgsql
security definer
set search_path=public,vault
as $$
declare v_ref uuid;
begin
  if length(trim(coalesce(p_client_id,''))) < 4 then raise exception 'spaceship_mcp_client_id_invalid'; end if;
  if length(trim(coalesce(p_client_secret,''))) < 8 then raise exception 'spaceship_mcp_client_secret_invalid'; end if;
  if p_redirect_uri !~ '^https://xbwuablxhhwsaoomsoco[.]supabase[.]co/functions/v1/hercules-private-bridge' then
    raise exception 'spaceship_mcp_redirect_uri_invalid';
  end if;

  select client_secret_secret_ref into v_ref
  from public.hercules_spaceship_mcp_oauth where singleton=true for update;

  if v_ref is null then
    v_ref := public.hercules_store_secret(
      p_client_secret,
      'spaceship-mcp-client-secret',
      'OAuth dynamic-registration client secret for Hercules Spaceship MCP.'
    );
  else
    perform vault.update_secret(v_ref,p_client_secret,'spaceship-mcp-client-secret',
      'OAuth dynamic-registration client secret for Hercules Spaceship MCP.',null);
  end if;

  update public.hercules_spaceship_mcp_oauth
  set client_id=trim(p_client_id),
      client_secret_secret_ref=v_ref,
      redirect_uri=p_redirect_uri,
      status=case when status='configured' then status else 'registered' end,
      updated_at=now()
  where singleton=true;

  p_client_secret := null;
  return true;
end;
$$;



revoke all on function public.hercules_spaceship_mcp_store_registration(text,text,text) from public,anon,authenticated;
grant execute on function public.hercules_spaceship_mcp_store_registration(text,text,text) to service_role;

create or replace function public.hercules_spaceship_mcp_begin()
returns bigint
language plpgsql
security definer
set search_path=public,extensions
as $$
declare v_ref uuid; v_key text; v_id bigint;
begin
  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='spaceship-dns' and enabled=true limit 1;
  if v_ref is null then raise exception 'spaceship_dns_internal_secret_missing'; end if;
  v_key := public.hercules_get_secret(v_ref);
  select net.http_post(
    url:='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge',
    headers:=jsonb_build_object('content-type','application/json','x-hercules-internal-key',v_key),
    body:='{"action":"spaceship_mcp_begin"}'::jsonb,
    timeout_milliseconds:=30000
  ) into v_id;
  v_key := null;
  return v_id;
end;
$$;
revoke all on function public.hercules_spaceship_mcp_begin() from public,anon,authenticated;
grant execute on function public.hercules_spaceship_mcp_begin() to service_role;

create or replace function public.hercules_domain_launch_autopilot_tick()
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_state public.hercules_domain_launch_autopilot%rowtype;
  v_credential_status text;
  v_configured_at timestamptz;
  v_auth jsonb;
  v_run record;
  v_submit_id bigint;
  v_a_id bigint;
  v_aaaa_id bigint;
  v_cname_id bigint;
  v_ns_id bigint;
  v_a_content text;
  v_aaaa_content text;
  v_cname_content text;
  v_ns_content text;
  v_a text[] := '{}'::text[];
  v_aaaa text[] := '{}'::text[];
  v_cname text[] := '{}'::text[];
  v_ns text[] := '{}'::text[];
  v_dns_ready boolean := false;
  v_now timestamptz := now();
begin
  select * into v_state
  from public.hercules_domain_launch_autopilot
  where singleton=true
  for update;

  if not found then
    insert into public.hercules_domain_launch_autopilot(singleton) values(true)
    returning * into v_state;
  end if;

  update public.hercules_domain_launch_autopilot
  set last_tick_at=v_now, updated_at=v_now
  where singleton=true;

  if not v_state.enabled then
    return jsonb_build_object('ok',true,'stage',v_state.stage,'enabled',false);
  end if;

  v_auth := public.hercules_spaceship_authorization_status();
  v_credential_status := case
    when coalesce((v_auth->>'authorized')::boolean,false) then 'configured'
    else 'unconfigured'
  end;
  v_configured_at := nullif(v_auth->>'authorizedAt','')::timestamptz;

  if coalesce(v_credential_status,'unconfigured') <> 'configured' then
    if v_state.stage <> 'waiting_authorization' then
      update public.hercules_domain_launch_autopilot
      set stage='waiting_authorization',
          dns_probe_ids=null,
          last_error=null,
          last_transition_at=v_now,
          updated_at=v_now
      where singleton=true;
    end if;

    return jsonb_build_object(
      'ok',true,
      'stage','waiting_authorization',
      'credentialStatus',coalesce(v_credential_status,'unconfigured'),
      'action','none'
    );
  end if;

  if v_state.stage in ('shopify_attach_pending','complete') then
    return jsonb_build_object(
      'ok',true,
      'stage',v_state.stage,
      'credentialStatus','configured',
      'action','none'
    );
  end if;

  select trace_id,status,error,started_at,completed_at,summary
    into v_run
    from public.hercules_spaceship_dns_runs
   where action='reconcile_shopify_dns'
     and domain='sauceapproved.com'
     and started_at >= coalesce(v_configured_at, v_now - interval '7 days')
   order by started_at desc
   limit 1;

  if found then
    if v_run.status='succeeded' then
      if v_state.stage <> 'dns_propagation' then
        update public.hercules_domain_launch_autopilot
        set stage='dns_propagation',
            dns_probe_ids=null,
            last_error=null,
            last_transition_at=v_now,
            metadata=metadata || jsonb_build_object(
              'lastProviderTraceId',v_run.trace_id,
              'lastProviderCompletedAt',v_run.completed_at
            ),
            updated_at=v_now
        where singleton=true;
        v_state.stage := 'dns_propagation';
        v_state.dns_probe_ids := null;
      end if;
    elsif v_run.status='running' and v_run.started_at > v_now - interval '10 minutes' then
      update public.hercules_domain_launch_autopilot
      set stage='dns_reconcile',
          last_error=null,
          metadata=metadata || jsonb_build_object('lastProviderTraceId',v_run.trace_id),
          updated_at=v_now
      where singleton=true;

      return jsonb_build_object(
        'ok',true,
        'stage','dns_reconcile',
        'providerRunStatus','running',
        'traceId',v_run.trace_id,
        'action','wait'
      );
    elsif v_run.status in ('failed','conflict') then
      update public.hercules_domain_launch_autopilot
      set stage='blocked',
          last_error=coalesce(v_run.error,'spaceship_dns_reconcile_blocked'),
          last_transition_at=case when v_state.stage<>'blocked' then v_now else last_transition_at end,
          metadata=metadata || jsonb_build_object(
            'lastProviderTraceId',v_run.trace_id,
            'lastProviderStatus',v_run.status
          ),
          updated_at=v_now
      where singleton=true;

      return jsonb_build_object(
        'ok',false,
        'stage','blocked',
        'providerRunStatus',v_run.status,
        'traceId',v_run.trace_id,
        'error',coalesce(v_run.error,'spaceship_dns_reconcile_blocked')
      );
    end if;
  end if;

  if not found or (v_run.status='running' and v_run.started_at <= v_now - interval '10 minutes') then
    v_submit_id := public.hercules_spaceship_dns_submit('reconcile', true);

    update public.hercules_domain_launch_autopilot
    set stage='dns_reconcile',
        last_provider_submit_id=v_submit_id,
        last_error=null,
        last_transition_at=case when v_state.stage<>'dns_reconcile' then v_now else last_transition_at end,
        metadata=metadata || jsonb_build_object('lastProviderSubmitId',v_submit_id),
        updated_at=v_now
    where singleton=true;

    return jsonb_build_object(
      'ok',true,
      'stage','dns_reconcile',
      'action','provider_reconcile_queued',
      'requestId',v_submit_id
    );
  end if;

  select * into v_state
  from public.hercules_domain_launch_autopilot
  where singleton=true;

  if v_state.stage <> 'dns_propagation' then
    return jsonb_build_object('ok',true,'stage',v_state.stage,'action','none');
  end if;

  if v_state.dns_probe_ids is null or v_state.dns_probe_ids='{}'::jsonb then
    select net.http_get(
      url:='https://dns.google/resolve?name=sauceapproved.com&type=A',
      timeout_milliseconds:=15000
    ) into v_a_id;

    select net.http_get(
      url:='https://dns.google/resolve?name=sauceapproved.com&type=AAAA',
      timeout_milliseconds:=15000
    ) into v_aaaa_id;

    select net.http_get(
      url:='https://dns.google/resolve?name=www.sauceapproved.com&type=CNAME',
      timeout_milliseconds:=15000
    ) into v_cname_id;

    select net.http_get(
      url:='https://dns.google/resolve?name=sauceapproved.com&type=NS',
      timeout_milliseconds:=15000
    ) into v_ns_id;

    update public.hercules_domain_launch_autopilot
    set dns_probe_ids=jsonb_build_object(
          'a',v_a_id,
          'aaaa',v_aaaa_id,
          'cname',v_cname_id,
          'ns',v_ns_id,
          'queuedAt',v_now
        ),
        updated_at=v_now
    where singleton=true;

    return jsonb_build_object(
      'ok',true,
      'stage','dns_propagation',
      'action','dns_probe_queued'
    );
  end if;

  select content into v_a_content
  from net._http_response
  where id=(v_state.dns_probe_ids->>'a')::bigint;

  select content into v_aaaa_content
  from net._http_response
  where id=(v_state.dns_probe_ids->>'aaaa')::bigint;

  select content into v_cname_content
  from net._http_response
  where id=(v_state.dns_probe_ids->>'cname')::bigint;

  select content into v_ns_content
  from net._http_response
  where id=(v_state.dns_probe_ids->>'ns')::bigint;

  if v_a_content is null or v_aaaa_content is null or v_cname_content is null or v_ns_content is null then
    return jsonb_build_object(
      'ok',true,
      'stage','dns_propagation',
      'action','wait_for_dns_probe'
    );
  end if;

  select coalesce(array_agg(distinct lower(trim(trailing '.' from item->>'data')) order by lower(trim(trailing '.' from item->>'data'))),'{}'::text[])
    into v_a
    from jsonb_array_elements(coalesce(v_a_content::jsonb->'Answer','[]'::jsonb)) item
   where coalesce((item->>'type')::int,0)=1;

  select coalesce(array_agg(distinct lower(trim(trailing '.' from item->>'data')) order by lower(trim(trailing '.' from item->>'data'))),'{}'::text[])
    into v_aaaa
    from jsonb_array_elements(coalesce(v_aaaa_content::jsonb->'Answer','[]'::jsonb)) item
   where coalesce((item->>'type')::int,0)=28;

  select coalesce(array_agg(distinct lower(trim(trailing '.' from item->>'data')) order by lower(trim(trailing '.' from item->>'data'))),'{}'::text[])
    into v_cname
    from jsonb_array_elements(coalesce(v_cname_content::jsonb->'Answer','[]'::jsonb)) item
   where coalesce((item->>'type')::int,0)=5;

  select coalesce(array_agg(distinct lower(trim(trailing '.' from item->>'data')) order by lower(trim(trailing '.' from item->>'data'))),'{}'::text[])
    into v_ns
    from jsonb_array_elements(coalesce(v_ns_content::jsonb->'Answer','[]'::jsonb)) item
   where coalesce((item->>'type')::int,0)=2;

  v_dns_ready :=
    v_a = array['23.227.38.65']::text[]
    and v_aaaa = array['2620:0127:f00f:5::']::text[]
    and v_cname = array['shops.myshopify.com']::text[];

  update public.hercules_domains
  set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'last_public_dns_observed_at',v_now,
        'last_public_dns',jsonb_build_object(
          'a',to_jsonb(v_a),
          'aaaa',to_jsonb(v_aaaa),
          'www_cname',to_jsonb(v_cname),
          'ns',to_jsonb(v_ns)
        ),
        'dns_ready_for_shopify',v_dns_ready,
        'domain_launch_autopilot','v1'
      ),
      updated_at=v_now
  where domain_name='sauceapproved.com'
    and status <> 'removed';

  if v_dns_ready then
    update public.hercules_domain_launch_autopilot
    set stage='shopify_attach_pending',
        dns_probe_ids=null,
        last_error=null,
        last_transition_at=v_now,
        metadata=metadata || jsonb_build_object(
          'dnsReadyAt',v_now,
          'observedA',to_jsonb(v_a),
          'observedAAAA',to_jsonb(v_aaaa),
          'observedCNAME',to_jsonb(v_cname),
          'observedNS',to_jsonb(v_ns)
        ),
        updated_at=v_now
    where singleton=true;

    return jsonb_build_object(
      'ok',true,
      'stage','shopify_attach_pending',
      'action','shopify_attachment_ready',
      'dns',jsonb_build_object(
        'a',to_jsonb(v_a),
        'aaaa',to_jsonb(v_aaaa),
        'cname',to_jsonb(v_cname),
        'ns',to_jsonb(v_ns)
      )
    );
  end if;

  update public.hercules_domain_launch_autopilot
  set dns_probe_ids=null,
      last_error=null,
      metadata=metadata || jsonb_build_object(
        'lastDnsProbeAt',v_now,
        'observedA',to_jsonb(v_a),
        'observedAAAA',to_jsonb(v_aaaa),
        'observedCNAME',to_jsonb(v_cname),
        'observedNS',to_jsonb(v_ns)
      ),
      updated_at=v_now
  where singleton=true;

  return jsonb_build_object(
    'ok',true,
    'stage','dns_propagation',
    'action','wait_for_dns_propagation',
    'dns',jsonb_build_object(
      'a',to_jsonb(v_a),
      'aaaa',to_jsonb(v_aaaa),
      'cname',to_jsonb(v_cname),
      'ns',to_jsonb(v_ns)
    )
  );
end;
$$;

revoke all on function public.hercules_domain_launch_autopilot_tick()
  from public, anon, authenticated;
grant execute on function public.hercules_domain_launch_autopilot_tick()
  to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='hercules-domain-launch-autopilot'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'hercules-domain-launch-autopilot',
    '*/5 * * * *',
    'select public.hercules_domain_launch_autopilot_tick();'
  );
end
$$;





comment on function public.hercules_spaceship_mcp_begin() is
  'Service-role-only launcher for Spaceship MCP OAuth through the existing Hercules Private Bridge.';
