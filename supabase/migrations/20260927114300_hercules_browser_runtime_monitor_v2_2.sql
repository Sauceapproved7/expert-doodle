-- Hercules Browser runtime monitor classifier hardening v2.2
-- Date: 2026-09-27
-- Distinguishes genuine upstream/CDP transport failures from action-level worker 502s.

create or replace function public.hercules_browser_runtime_monitor()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_activated timestamptz;
  v_total integer:=0;
  v_failed integer:=0;
  v_transient integer:=0;
  v_exhausted integer:=0;
  v_stale integer:=0;
  v_p95 numeric:=0;
  v_latest_probe_status text;
  v_latest_probe_at timestamptz;
  v_probe_fresh boolean:=false;
  v_ok boolean:=false;
  v_error text;
  v_open_incident uuid;
  v_details jsonb;
begin
  select coalesce((metadata->>'activated_at')::timestamptz,created_at)
    into v_activated
    from public.hercules_service_registry
   where service_slug='hercules-browser-runtime';

  with recent as (
    select *
      from public.hercules_browser_runs
     where created_at >= greatest(coalesce(v_activated,now()-interval '15 minutes'),now()-interval '15 minutes')
  )
  select
    count(*)::integer,
    count(*) filter(where status='failed')::integer,
    count(*) filter(
      where coalesce(error,'') ~* 'failed to connect to backend|service unavailable|bad gateway|too many requests|websocket was closed before the connection was established|connectovercdp.{0,200}(429|502|503|504)|ws unexpected response.{0,200}(429|502|503|504)'
    )::integer,
    count(*) filter(where status='failed' and attempt_count >= 3)::integer,
    count(*) filter(where status='running' and created_at < now()-interval '3 minutes')::integer,
    coalesce(percentile_cont(0.95) within group(order by extract(epoch from (completed_at-started_at))*1000)
      filter(where completed_at is not null and started_at is not null),0)
  into v_total,v_failed,v_transient,v_exhausted,v_stale,v_p95
  from recent;

  select status,completed_at
    into v_latest_probe_status,v_latest_probe_at
    from public.hercules_browser_runs
   where request->>'source'='hercules-browser-health-probe'
   order by created_at desc
   limit 1;

  v_probe_fresh:=coalesce(v_latest_probe_at >= now()-interval '25 minutes',false);
  v_ok:=v_probe_fresh
    and v_latest_probe_status='succeeded'
    and v_transient=0
    and v_exhausted=0
    and v_stale=0
    and v_p95 <= 45000;

  if not v_probe_fresh then v_error:='health_probe_stale_or_missing';
  elsif v_latest_probe_status<>'succeeded' then v_error:='health_probe_failed';
  elsif v_stale>0 then v_error:='stale_runtime_timeout';
  elsif v_exhausted>0 then v_error:='retry_exhaustion_detected';
  elsif v_transient>0 then v_error:='transient_upstream_failure_detected';
  elsif v_p95>45000 then v_error:='browser_latency_spike';
  else v_error:=null;
  end if;

  v_details:=jsonb_build_object(
    'windowRuns',v_total,
    'failedRuns',v_failed,
    'transientFailures',v_transient,
    'retryExhaustions',v_exhausted,
    'staleRuns',v_stale,
    'p95LatencyMs',round(v_p95),
    'latestProbeStatus',v_latest_probe_status,
    'latestProbeAt',v_latest_probe_at,
    'probeFresh',v_probe_fresh,
    'maxConcurrency',1,
    'classifierVersion','2.2'
  );

  insert into public.hercules_service_health_checks(
    service_slug,ok,status_code,latency_ms,error,details
  )
  values(
    'hercules-browser-runtime',
    v_ok,
    case when v_ok then 200 else 503 end,
    case when v_p95>2147483647 then 2147483647 else round(v_p95)::integer end,
    v_error,
    v_details
  );

  select id into v_open_incident
    from public.hercules_service_incidents
   where service_slug='hercules-browser-runtime'
     and status='open'
   order by opened_at desc
   limit 1;

  if v_ok then
    update public.hercules_service_incidents
       set status='resolved',
           resolved_at=now(),
           last_seen_at=now(),
           metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('resolution','runtime_monitor_recovered')
     where service_slug='hercules-browser-runtime'
       and status='open';
  elsif v_open_incident is null then
    insert into public.hercules_service_incidents(
      service_slug,status,last_error,metadata
    )
    values(
      'hercules-browser-runtime','open',v_error,v_details
    );
  else
    update public.hercules_service_incidents
       set last_seen_at=now(),
           failure_count=failure_count+1,
           last_error=v_error,
           metadata=v_details
     where id=v_open_incident;
  end if;

  return jsonb_build_object('ok',v_ok,'error',v_error,'details',v_details);
end;
$$;

revoke all on function public.hercules_browser_runtime_monitor() from public, anon, authenticated;
grant execute on function public.hercules_browser_runtime_monitor() to service_role;

comment on function public.hercules_browser_runtime_monitor() is
  'Hercules Browser runtime monitor v2.2: reports genuine CDP/gateway transport failures separately from ordinary browser action failures.';
