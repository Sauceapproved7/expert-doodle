create or replace function private.hercules_owner_checkpoint_refresh_one(p_checkpoint_key text)
returns text
language plpgsql
set search_path = private, public, pg_temp
as $$
declare
  c private.hercules_owner_checkpoints%rowtype;
  v_authorized boolean := false;
  v_status text;
  v_policy text;
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

  v_policy := coalesce(c.metadata->>'authorization_policy','provider_active');

  if v_policy = 'stripe_live_payments' then
    select exists (
      select 1
      from public.hercules_provider_connections p
      where p.organization_id = c.organization_id
        and p.provider = 'stripe'
        and p.status = 'active'
        and (c.account_key is null or p.account_key = c.account_key)
        and p.access_secret_ref is not null
        and lower(coalesce(p.metadata->>'livemode','false')) = 'true'
        and lower(coalesce(p.metadata->>'charges_enabled','false')) = 'true'
        and lower(coalesce(p.metadata->>'payouts_enabled','false')) = 'true'
    ) into v_authorized;
  else
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
  end if;

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
        'authorization_policy', v_policy,
        'authorization_observed', v_authorized,
        'authorization_source', case when v_authorized then 'hercules_provider_connections' else null end,
        'last_probe_at', now()
      ),
      updated_at = now()
  where checkpoint_key = p_checkpoint_key;

  return v_status;
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
  'DA-27:stripe-live-owner-auth',
  o.organization_id,
  'DA-27',
  'stripe',
  null,
  'pending_owner_auth',
  jsonb_build_object(
    'after_authorization', jsonb_build_array(
      'verify_live_provider_capability',
      'resume_controlled_checkout',
      'verify_refund_reversal',
      'verify_payout_state',
      'release_eligible_sales_queue'
    ),
    'public_paid_launch', false
  ),
  jsonb_build_object(
    'live_provider_connection_present', false,
    'observed_at', now()
  ),
  jsonb_build_object(
    'authorization_policy', 'stripe_live_payments',
    'browser_dependency', 'owner_handoff_only',
    'owner_boundary', jsonb_build_array(
      'provider_login',
      'identity_verification',
      'bank_authorization',
      'provider_consent',
      'live_credential_authorization'
    ),
    'automated_after_authorization', jsonb_build_array(
      'provider_capability_probe',
      'webhook_verification',
      'controlled_checkout_test',
      'refund_reversal_check',
      'payout_state_check'
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
    metadata = private.hercules_owner_checkpoints.metadata || excluded.metadata,
    status = case
      when private.hercules_owner_checkpoints.status in ('ready','resuming','completed')
        then private.hercules_owner_checkpoints.status
      else excluded.status
    end,
    updated_at = now();

select private.hercules_owner_checkpoint_refresh_one('DA-27:stripe-live-owner-auth');
