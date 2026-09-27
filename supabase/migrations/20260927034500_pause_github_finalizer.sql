begin;

update cron.job
set active=false
where jobname='hercules-github-finalizer';

do $$
declare
  v_active boolean;
begin
  select active into v_active
  from cron.job
  where jobname='hercules-github-finalizer';

  if v_active is distinct from false then
    raise exception 'GitHub finalizer cron was not paused';
  end if;
end
$$;

commit;
