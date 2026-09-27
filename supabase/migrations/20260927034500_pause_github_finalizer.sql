begin;

do $$
declare
  v_job_id bigint;
  v_active boolean;
begin
  select jobid
    into v_job_id
  from cron.job
  where jobname='hercules-github-finalizer'
  limit 1;

  if v_job_id is null then
    raise exception 'GitHub finalizer cron job not found';
  end if;

  perform cron.alter_job(
    job_id := v_job_id,
    active := false
  );

  select active
    into v_active
  from cron.job
  where jobid=v_job_id;

  if v_active is distinct from false then
    raise exception 'GitHub finalizer cron was not paused';
  end if;
end
$$;

commit;
