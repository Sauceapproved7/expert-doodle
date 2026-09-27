begin;

create or replace function public.hercules_evaluate_slos()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org uuid := 'ea5fb196-67f9-42fa-b592-49eeb3b84346';
  v_now timestamptz := now();
  v_critical numeric := 1;
  v_probe_coverage numeric := 1;
  v_command numeric := 1;
  v_release numeric := 1;
  v_attestation numeric := 1;
  v_health_conclusive integer := 0;
  v_probe_conclusive integer := 0;
  v_tier0 integer := 0;
  v_probe_window integer := 45;
  v_count integer := 0;
begin
  select coalesce(window_minutes,45)
    into v_probe_window
  from public.hercules_slo_definitions
  where organization_id=v_org
    and slo_id='critical-probe-coverage'
    and enabled=true
  limit 1;

  with crit as (
    select service_slug
    from public.hercules_service_registry
    where enabled=true and critical=true
  ),
  latest as (
    select distinct on (h.service_slug)
      h.service_slug,h.ok,h.error,h.status_code,h.checked_at
    from public.hercules_service_health_checks h
    join crit c on c.service_slug=h.service_slug
    order by h.service_slug,h.checked_at desc
  ),
  classified as (
    select
      c.service_slug,l.ok,l.error,l.status_code,l.checked_at,
      case
        when l.checked_at is null or l.checked_at < v_now-interval '15 minutes' then false
        when coalesce(l.error,'') ilike 'Rate limit exceeded%' then false
        when coalesce(l.error,'') ilike 'Signal timed out.%' and l.status_code is null then false
        else true
      end as health_conclusive,
      case
        when l.checked_at is null or l.checked_at < v_now-make_interval(mins=>v_probe_window) then false
        when coalesce(l.error,'') ilike 'Rate limit exceeded%' then false
        when coalesce(l.error,'') ilike 'Signal timed out.%' and l.status_code is null then false
        else true
      end as probe_conclusive
    from crit c
    left join latest l on l.service_slug=c.service_slug
  )
  select
    coalesce(avg(case when health_conclusive then case when ok then 1.0 else 0.0 end end),1.0),
    count(*) filter(where health_conclusive),
    count(*) filter(where probe_conclusive),
    count(*)
  into v_critical,v_health_conclusive,v_probe_conclusive,v_tier0
  from classified;

  v_probe_coverage := case when v_tier0=0 then 1.0 else v_probe_conclusive::numeric/v_tier0::numeric end;

  select coalesce(
    count(*) filter (where status='succeeded')::numeric /
    nullif(count(*) filter (where status in ('succeeded','failed','dead_letter')),0),
    1.0
  )
  into v_command
  from public.hercules_command_requests
  where organization_id=v_org
    and updated_at>=v_now-interval '60 minutes';

  select coalesce(
    count(*) filter (where status='verified')::numeric /
    nullif(count(*) filter (where status in ('verified','failed')),0),
    1.0
  )
  into v_release
  from public.hercules_release_queue
  where organization_id=v_org
    and admission_decision is not null
    and updated_at>=v_now-interval '24 hours';

  with admitted as (
    select release_id
    from public.hercules_release_queue
    where organization_id=v_org
      and admission_decision='allow'
      and status='verified'
      and updated_at>=v_now-interval '24 hours'
  )
  select coalesce(
    count(*) filter (where a.verified=true)::numeric / nullif(count(*),0),
    1.0
  )
  into v_attestation
  from admitted r
  left join public.hercules_release_attestations a on a.release_id=r.release_id;

  insert into public.hercules_slo_evaluations(
    organization_id,slo_id,observed,target,passed,window_start,window_end,details
  )
  select v_org,d.slo_id,
    case d.metric_name
      when 'critical_service_health_ratio' then v_critical
      when 'critical_probe_coverage_ratio' then v_probe_coverage
      when 'command_success_ratio' then v_command
      when 'release_verified_ratio' then v_release
      when 'attestation_coverage_ratio' then v_attestation
      else 0
    end,
    d.target,
    case d.comparison
      when 'gte' then (
        case d.metric_name
          when 'critical_service_health_ratio' then v_critical
          when 'critical_probe_coverage_ratio' then v_probe_coverage
          when 'command_success_ratio' then v_command
          when 'release_verified_ratio' then v_release
          when 'attestation_coverage_ratio' then v_attestation
          else 0
        end
      ) >= d.target
      else (
        case d.metric_name
          when 'critical_service_health_ratio' then v_critical
          when 'critical_probe_coverage_ratio' then v_probe_coverage
          when 'command_success_ratio' then v_command
          when 'release_verified_ratio' then v_release
          when 'attestation_coverage_ratio' then v_attestation
          else 0
        end
      ) <= d.target
    end,
    v_now-make_interval(mins=>d.window_minutes),
    v_now,
    case d.metric_name
      when 'critical_service_health_ratio' then jsonb_build_object(
        'metric_name',d.metric_name,'severity',d.severity,
        'conclusive_tier0_probes',v_health_conclusive,'tier0_registered',v_tier0,
        'inconclusive_probes',greatest(v_tier0-v_health_conclusive,0),
        'freshness_minutes',15
      )
      when 'critical_probe_coverage_ratio' then jsonb_build_object(
        'metric_name',d.metric_name,'severity',d.severity,
        'conclusive_tier0_probes',v_probe_conclusive,'tier0_registered',v_tier0,
        'freshness_minutes',v_probe_window
      )
      else jsonb_build_object(
        'metric_name',d.metric_name,'severity',d.severity,
        'admission_era_only',d.metric_name in ('release_verified_ratio','attestation_coverage_ratio')
      )
    end
  from public.hercules_slo_definitions d
  where d.organization_id=v_org and d.enabled=true;

  get diagnostics v_count = row_count;

  insert into public.hercules_observability_rollups(organization_id,metric_name,metric_value,dimensions)
  values
    (v_org,'slo.critical_service_health_ratio',v_critical,jsonb_build_object('source','hercules_evaluate_slos','conclusive',v_health_conclusive,'tier0',v_tier0,'freshness_minutes',15)),
    (v_org,'slo.critical_probe_coverage_ratio',v_probe_coverage,jsonb_build_object('source','hercules_evaluate_slos','conclusive',v_probe_conclusive,'tier0',v_tier0,'freshness_minutes',v_probe_window)),
    (v_org,'slo.command_success_ratio',v_command,'{"source":"hercules_evaluate_slos"}'::jsonb),
    (v_org,'slo.release_verified_ratio',v_release,'{"source":"hercules_evaluate_slos","admission_era_only":true}'::jsonb),
    (v_org,'slo.attestation_coverage_ratio',v_attestation,'{"source":"hercules_evaluate_slos","admission_era_only":true}'::jsonb);

  return v_count;
end;
$function$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.hercules_evaluate_slos()'::regprocedure) into v_def;
  if position('v_probe_window' in v_def)=0 or position('probe_conclusive' in v_def)=0 then
    raise exception 'Hercules SLO evaluator calibration was not installed';
  end if;
end
$$;

commit;
