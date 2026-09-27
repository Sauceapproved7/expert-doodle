create or replace function public.hercules_browser_agent_reap_stale()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
  v_now timestamptz := now();
begin
  update public.hercules_browser_agent_runs
  set status='failed',
      error=coalesce(error,'stale_runtime_timeout'),
      completed_at=coalesce(completed_at,v_now),
      updated_at=v_now,
      result=coalesce(result,'{}'::jsonb) || jsonb_build_object(
        'reaped',true,
        'reason','stale_runtime_timeout',
        'reapedAt',v_now
      )
  where status='running'
    and completed_at is null
    and updated_at < v_now - interval '5 minutes';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.hercules_browser_agent_reap_stale()
  from public, anon, authenticated;
grant execute on function public.hercules_browser_agent_reap_stale()
  to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='hercules-browser-agent-stale-reaper'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'hercules-browser-agent-stale-reaper',
    '*/5 * * * *',
    'select public.hercules_browser_agent_reap_stale();'
  );
end
$$;

comment on function public.hercules_browser_agent_reap_stale() is
  'Marks Browser Agent runs failed after five minutes without an update, preventing orphaned running state after Edge runtime termination.';
