-- Keep Hercules launch-gate readiness evidence fresh.
-- The internal key is read only inside this SECURITY DEFINER function and is
-- never stored in pg_cron metadata or returned to callers.

create or replace function private.hercules_launch_gate_refresh_submit()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_ref uuid;
  v_secret text;
  v_request_id bigint;
begin
  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose = 'agent-coordinator'
    and enabled = true
  order by updated_at desc
  limit 1;

  if v_ref is null then
    raise exception 'launch_gate_refresh_credential_unavailable';
  end if;

  v_secret := public.hercules_get_secret(v_ref);
  if v_secret is null or length(v_secret) = 0 then
    raise exception 'launch_gate_refresh_credential_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch-gate',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-hercules-internal-key',v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function private.hercules_launch_gate_refresh_submit()
  from public, anon, authenticated;
grant execute on function private.hercules_launch_gate_refresh_submit()
  to service_role;

do $block$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='hercules-launch-gate-freshness'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$block$;

select cron.schedule(
  'hercules-launch-gate-freshness',
  '*/10 * * * *',
  'SELECT private.hercules_launch_gate_refresh_submit();'
);

SELECT private.hercules_launch_gate_refresh_submit();
