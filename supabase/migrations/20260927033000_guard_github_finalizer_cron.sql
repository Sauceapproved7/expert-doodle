begin;

create or replace function public.hercules_github_finalizer_cron_tick()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'vault'
as $function$
declare
  v_ref uuid;
  v_secret text;
  v_request_id bigint;
  v_ready boolean := false;
begin
  select exists(
    select 1
    from public.hercules_provider_connections c
    where c.provider='github_forge'
      and c.account_key='Sauceapproved7/expert-doodle'
      and c.status in ('pending','error')
      and c.secret_ref is not null
      and coalesce(c.metadata->>'app_id','') <> ''
  ) into v_ready;

  if not v_ready then
    return 0;
  end if;

  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='github-finalizer'
    and enabled=true;

  if v_ref is null then
    raise exception 'github_finalizer_secret_missing';
  end if;

  v_secret := public.hercules_get_secret(v_ref);

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-github-app',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-hercules-internal-key',v_secret
    ),
    body := '{"action":"reconcile"}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.hercules_github_finalizer_cron_tick()'::regprocedure)
  into v_def;

  if position('c.status in (''pending'',''error'')' in v_def)=0
     or position('c.secret_ref is not null' in v_def)=0
     or position('return 0' in v_def)=0 then
    raise exception 'GitHub finalizer cron guard was not installed';
  end if;
end
$$;

commit;
