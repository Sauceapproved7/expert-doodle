begin;

create or replace function public.hercules_sync_github_finalizer_cron_state()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'cron'
as $function$
declare
  v_enable boolean;
begin
  if new.provider <> 'github_forge'
     or new.account_key <> 'Sauceapproved7/expert-doodle' then
    return new;
  end if;

  v_enable :=
    new.status in ('pending','error')
    and new.secret_ref is not null
    and coalesce(new.metadata->>'app_id','') <> '';

  update cron.job
  set active=v_enable
  where jobname='hercules-github-finalizer';

  return new;
end;
$function$;

drop trigger if exists hercules_sync_github_finalizer_cron_state
on public.hercules_provider_connections;

create trigger hercules_sync_github_finalizer_cron_state
after insert or update of status,secret_ref,metadata
on public.hercules_provider_connections
for each row
execute function public.hercules_sync_github_finalizer_cron_state();

update cron.job
set active=exists(
  select 1
  from public.hercules_provider_connections c
  where c.provider='github_forge'
    and c.account_key='Sauceapproved7/expert-doodle'
    and c.status in ('pending','error')
    and c.secret_ref is not null
    and coalesce(c.metadata->>'app_id','') <> ''
)
where jobname='hercules-github-finalizer';

do $$
declare
  v_active boolean;
begin
  select active into v_active
  from cron.job
  where jobname='hercules-github-finalizer';

  if v_active is distinct from false then
    raise exception 'GitHub finalizer cron should be idle before App creation';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname='hercules_sync_github_finalizer_cron_state'
      and not tgisinternal
  ) then
    raise exception 'GitHub finalizer cron state trigger was not installed';
  end if;
end
$$;

commit;
