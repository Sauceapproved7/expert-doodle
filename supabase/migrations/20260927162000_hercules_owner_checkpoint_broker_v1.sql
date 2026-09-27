create table if not exists private.hercules_owner_checkpoints (
  checkpoint_key text primary key,
  organization_id uuid not null,
  work_item text not null,
  provider text not null,
  account_key text,
  status text not null default 'pending_owner_auth'
    check (status in ('pending_owner_auth','ready','resuming','completed','blocked')),
  next_action jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_checked_at timestamptz,
  ready_at timestamptz,
  resumed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.hercules_owner_checkpoints is
  'Durable Hercules checkpoints for work that is complete except for legitimate owner/provider authorization. Stores no credentials, MFA values, CAPTCHA responses, cookies, or provider secrets.';

create or replace function private.hercules_owner_checkpoint_refresh_one(p_checkpoint_key text)
returns text
language plpgsql
set search_path = private, public, pg_temp
as $$
declare
  c private.hercules_owner_checkpoints%rowtype;
  v_authorized boolean := false;
  v_status text;
begin
  select * into c
  from private.hercules_owner_checkpoints
  where checkpoint_key = p_checkpoint_key
  for update;

  if not found then
    return 'missing';
  end if;

  if c.status = 'completed' then
    return c.status;
  end if;

  select exists (
    select 1
    from public.hercules_provider_connections p
    where p.organization_id = c.organization_id
      and p.provider = c.provider
      and p.status = 'active'
      and (c.account_key is null or p.account_key = c.account_key)
      and (
        p.connected_at is not null
        or p.access_secret_ref is not null
        or lower(coalesce(p.metadata->>'authorized','false')) = 'true'
      )
  ) into v_authorized;

  v_status := case
    when v_authorized then 'ready'
    when c.status = 'resuming' then 'resuming'
    else 'pending_owner_auth'
  end;

  update private.hercules_owner_checkpoints
  set status = v_status,
      attempt_count = attempt_count + 1,
      last_checked_at = now(),
      ready_at = case
        when v_authorized then coalesce(ready_at, now())
        else ready_at
      end,
      last_error = case when v_authorized then null else last_error end,
      evidence = evidence || jsonb_build_object(
        'authorization_observed', v_authorized,
        'authorization_source', case when v_authorized then 'hercules_provider_connections' else null end,
        'last_probe_at', now()
      ),
      updated_at = now()
  where checkpoint_key = p_checkpoint_key;

  return v_status;
end;
$$;

create or replace function private.hercules_owner_checkpoint_refresh_all()
returns integer
language plpgsql
set search_path = private, public, pg_temp
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select checkpoint_key
    from private.hercules_owner_checkpoints
    where status in ('pending_owner_auth','ready','blocked')
    order by created_at
  loop
    perform private.hercules_owner_checkpoint_refresh_one(r.checkpoint_key);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

insert into private.hercules_owner_checkpoints (
  checkpoint_key,
  organization_id,
  work_item,
  provider,
  account_key,
  status,
  next_action,
  evidence,
  metadata
)
select
  'DA-24:linkedin-owner-auth',
  o.organization_id,
  'DA-24',
  'linkedin',
  null,
  'pending_owner_auth',
  jsonb_build_object(
    'after_authorization', jsonb_build_array(
      'verify_or_create_sauceapproved_company_page',
      'connect_metricool_brand',
      'confirm_scheduling_availability'
    ),
    'publish_post', false
  ),
  jsonb_build_object(
    'metricool_brand_connected_social_networks', 0,
    'observed_at', now()
  ),
  jsonb_build_object(
    'browser_dependency', 'none',
    'optional_personal_browser_bridge', true,
    'owner_boundary', jsonb_build_array(
      'login',
      'mfa',
      'captcha',
      'terms',
      'provider_consent'
    )
  )
from (
  select organization_id
  from public.hercules_provider_connections
  order by case when provider = 'shopify' then 0 else 1 end, updated_at desc
  limit 1
) o
on conflict (checkpoint_key) do update
set next_action = excluded.next_action,
    evidence = private.hercules_owner_checkpoints.evidence || excluded.evidence,
    metadata = private.hercules_owner_checkpoints.metadata || excluded.metadata,
    status = case
      when private.hercules_owner_checkpoints.status in ('ready','resuming','completed')
        then private.hercules_owner_checkpoints.status
      else excluded.status
    end,
    updated_at = now();

do $$
declare
  j bigint;
begin
  select jobid into j
  from cron.job
  where jobname = 'hercules-owner-checkpoint-broker'
  limit 1;

  if j is not null then
    perform cron.unschedule(j);
  end if;
end;
$$;

select cron.schedule(
  'hercules-owner-checkpoint-broker',
  '*/5 * * * *',
  'select private.hercules_owner_checkpoint_refresh_all();'
);

select private.hercules_owner_checkpoint_refresh_all();
