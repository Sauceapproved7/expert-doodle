create or replace function public.hercules_sync_storefront_smoke_to_launch_readiness()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_answer text;
  v_verified boolean;
  v_when timestamptz;
  v_verification jsonb;
begin
  if new.requested_by <> 'hercules-storefront-smoke' then
    return new;
  end if;

  if new.status not in ('succeeded','failed','blocked') then
    return new;
  end if;

  v_answer := coalesce(new.result->>'answer','');
  v_when := coalesce(new.completed_at,new.updated_at,now());

  v_verified :=
    new.status='succeeded'
    and position('Publicly reachable: yes' in v_answer)>0
    and position('SauceApproved hoodie visible: yes' in v_answer)>0
    and position('Size/color variant controls visible: yes' in v_answer)>0
    and position('Add-to-cart or purchase control visible: yes' in v_answer)>0;

  v_verification := jsonb_build_object(
    'runId',new.run_id,
    'source','hercules-storefront-smoke-v1',
    'observedAt',v_when,
    'url',new.start_url,
    'pageTitle',coalesce(new.result#>>'{page,title}',''),
    'convergence',coalesce(new.result->>'convergence',''),
    'publiclyReachable',position('Publicly reachable: yes' in v_answer)>0,
    'productVisible',position('SauceApproved hoodie visible: yes' in v_answer)>0,
    'variantsVisible',position('Size/color variant controls visible: yes' in v_answer)>0,
    'purchaseControlVisible',position('Add-to-cart or purchase control visible: yes' in v_answer)>0,
    'browserStatus',new.status,
    'error',new.error
  );

  update public.hercules_shopify_launch_readiness
  set storefront_status=case when v_verified then 'verified' else 'failed' end,
      storefront_verified_at=case when v_verified then v_when else null end,
      storefront_verification=v_verification,
      snapshot=jsonb_set(
        coalesce(snapshot,'{}'::jsonb),
        '{storefrontVerification}',
        v_verification,
        true
      ),
      updated_at=now()
  where singleton=true;

  return new;
end;
$$;

drop trigger if exists hercules_storefront_smoke_readiness_insert
  on public.hercules_browser_agent_runs;

create trigger hercules_storefront_smoke_readiness_insert
after insert
on public.hercules_browser_agent_runs
for each row
execute function public.hercules_sync_storefront_smoke_to_launch_readiness();

drop trigger if exists hercules_storefront_smoke_readiness_update
  on public.hercules_browser_agent_runs;

create trigger hercules_storefront_smoke_readiness_update
after update of status,result,error,completed_at
on public.hercules_browser_agent_runs
for each row
execute function public.hercules_sync_storefront_smoke_to_launch_readiness();

comment on function public.hercules_sync_storefront_smoke_to_launch_readiness() is
  'Synchronizes completed hourly Hercules Browser storefront smoke evidence into the production Shopify launch-readiness storefront verification fields.';
