-- Hercules Browser runtime monitor + single-worker admission control v2
-- Date: 2026-09-27

create table if not exists public.hercules_browser_worker_capacity (
  worker_name text primary key,
  max_concurrency integer not null check (max_concurrency between 1 and 16),
  lease_ttl_seconds integer not null default 75 check (lease_ttl_seconds between 15 and 300),
  updated_at timestamptz not null default now()
);

create table if not exists public.hercules_browser_worker_leases (
  lease_id uuid primary key default gen_random_uuid(),
  worker_name text not null references public.hercules_browser_worker_capacity(worker_name) on delete cascade,
  trace_id text not null,
  leased_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists hercules_browser_worker_leases_worker_expiry_idx
  on public.hercules_browser_worker_leases(worker_name,expires_at);

alter table public.hercules_browser_worker_capacity enable row level security;
alter table public.hercules_browser_worker_leases enable row level security;
revoke all on table public.hercules_browser_worker_capacity from public, anon, authenticated;
revoke all on table public.hercules_browser_worker_leases from public, anon, authenticated;
grant select,insert,update,delete on table public.hercules_browser_worker_capacity to service_role;
grant select,insert,update,delete on table public.hercules_browser_worker_leases to service_role;

insert into public.hercules_browser_worker_capacity(worker_name,max_concurrency,lease_ttl_seconds)
values ('primary',1,75)
on conflict (worker_name) do update
set max_concurrency=excluded.max_concurrency,
    lease_ttl_seconds=excluded.lease_ttl_seconds,
    updated_at=now();

create or replace function public.hercules_browser_worker_lease_acquire(
  p_worker_name text,
  p_trace_id text,
  p_ttl_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_capacity integer;
  v_default_ttl integer;
  v_active integer;
  v_lease uuid;
  v_ttl integer;
begin
  if coalesce(trim(p_worker_name),'')='' or coalesce(trim(p_trace_id),'')='' then
    raise exception 'browser_worker_lease_identity_required';
  end if;

  select max_concurrency,lease_ttl_seconds
    into v_capacity,v_default_ttl
    from public.hercules_browser_worker_capacity
   where worker_name=p_worker_name
   for update;

  if v_capacity is null then
    raise exception 'browser_worker_capacity_missing';
  end if;

  delete from public.hercules_browser_worker_leases
   where worker_name=p_worker_name
     and expires_at <= now();

  select count(*)::integer
    into v_active
    from public.hercules_browser_worker_leases
   where worker_name=p_worker_name
     and expires_at > now();

  if v_active >= v_capacity then
    return null;
  end if;

  v_ttl:=greatest(15,least(300,coalesce(p_ttl_seconds,v_default_ttl,75)));

  insert into public.hercules_browser_worker_leases(worker_name,trace_id,expires_at)
  values(p_worker_name,left(p_trace_id,200),now()+make_interval(secs=>v_ttl))
  returning lease_id into v_lease;

  return v_lease;
end;
$$;

create or replace function public.hercules_browser_worker_lease_release(
  p_lease_id uuid,
  p_trace_id text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_deleted integer;
begin
  delete from public.hercules_browser_worker_leases
   where lease_id=p_lease_id
     and trace_id=left(coalesce(p_trace_id,''),200);
  get diagnostics v_deleted=row_count;
  return v_deleted=1;
end;
$$;

revoke all on function public.hercules_browser_worker_lease_acquire(text,text,integer) from public,anon,authenticated;
revoke all on function public.hercules_browser_worker_lease_release(uuid,text) from public,anon,authenticated;
grant execute on function public.hercules_browser_worker_lease_acquire(text,text,integer) to service_role;
grant execute on function public.hercules_browser_worker_lease_release(uuid,text) to service_role;

insert into public.hercules_service_registry(service_slug,display_name,health_path,enabled,critical,metadata)
values(
  'hercules-browser-runtime',
  'Hercules Browser Runtime',
  '/functions/v1/hercules-browser',
  true,
  true,
  jsonb_build_object(
    'probe','owned-browser-navigation',
    'monitor_version','2',
    'activated_at',now(),
    'max_concurrency',1
  )
)
on conflict (service_slug) do update
set display_name=excluded.display_name,
    health_path=excluded.health_path,
    enabled=true,
    critical=true,
    metadata=coalesce(public.hercules_service_registry.metadata,'{}'::jsonb) || excluded.metadata,
    updated_at=now();

create or replace function public.hercules_browser_health_probe_submit()
returns bigint
language plpgsql
security definer
set search_path=public,extensions
as $$
begin
  return public.hercules_browser_submit(
    jsonb_build_object(
      'action','navigate',
      'url','https://example.com/?hercules-health-probe=1',
      'persistSession',false,
      'timeoutMs',30000,
      'maxTextChars',5000,
      'source','hercules-browser-health-probe'
    )
  );
end;
$$;

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
    count(*) filter(where coalesce(error,'') ~* 'worker_http_(502|503|504)|429 Too Many Requests|failed to connect to backend|websocket was closed before the connection was established')::integer,
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
    'maxConcurrency',1
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

revoke all on function public.hercules_browser_health_probe_submit() from public, anon, authenticated;
revoke all on function public.hercules_browser_runtime_monitor() from public, anon, authenticated;
grant execute on function public.hercules_browser_health_probe_submit() to service_role;
grant execute on function public.hercules_browser_runtime_monitor() to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='hercules-browser-health-probe' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'hercules-browser-health-probe',
    '*/15 * * * *',
    'select public.hercules_browser_health_probe_submit();'
  );

  select jobid into v_jobid from cron.job where jobname='hercules-browser-runtime-monitor' limit 1;
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'hercules-browser-runtime-monitor',
    '*/5 * * * *',
    'select public.hercules_browser_runtime_monitor();'
  );
end
$$;

comment on table public.hercules_browser_worker_capacity is
  'Hercules-owned browser upstream admission control. Production primary is deliberately capped to one simultaneous CDP start until the upstream capacity is increased and re-certified.';
comment on table public.hercules_browser_worker_leases is
  'Short-lived server-only leases preventing concurrent browser starts from stampeding the current Browserless upstream.';
comment on function public.hercules_browser_runtime_monitor() is
  'Evaluates real Hercules Browser execution health: active probe freshness, transient CDP failures, retry exhaustion, p95 latency and stale running executions.';
