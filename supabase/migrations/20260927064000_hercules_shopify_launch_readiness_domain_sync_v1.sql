create or replace function public.hercules_sync_shopify_launch_readiness_from_domain()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_domain_complete boolean;
  v_storefront_ready boolean;
  v_current_stage text;
  v_next_stage text;
  v_now timestamptz := now();
begin
  v_domain_complete :=
    new.stage='complete'
    and coalesce(new.intended_domain_present,false)
    and coalesce(new.intended_domain_ssl_enabled,false)
    and lower(coalesce(new.current_primary_host,''))='sauceapproved.com';

  select
    coalesce((gates->>'storefrontReady')::boolean,false),
    stage
  into v_storefront_ready, v_current_stage
  from public.hercules_shopify_launch_readiness
  where singleton=true
  for update;

  if not found then
    return new;
  end if;

  if v_storefront_ready and v_domain_complete then
    v_next_stage := 'ready';
  elsif v_storefront_ready then
    v_next_stage := 'ready_except_domain';
  else
    v_next_stage := 'blocked_storefront';
  end if;

  update public.hercules_shopify_launch_readiness
  set gates=jsonb_set(
        coalesce(gates,'{}'::jsonb),
        '{domainComplete}',
        to_jsonb(v_domain_complete),
        true
      ),
      stage=v_next_stage,
      last_transition_at=case
        when v_current_stage is distinct from v_next_stage then v_now
        else last_transition_at
      end,
      updated_at=v_now
  where singleton=true;

  return new;
end;
$$;

drop trigger if exists hercules_shopify_launch_readiness_domain_sync
  on public.hercules_shopify_domain_cutover;

create trigger hercules_shopify_launch_readiness_domain_sync
after insert or update of
  stage,
  intended_domain_present,
  intended_domain_ssl_enabled,
  current_primary_host
on public.hercules_shopify_domain_cutover
for each row
execute function public.hercules_sync_shopify_launch_readiness_from_domain();

comment on function public.hercules_sync_shopify_launch_readiness_from_domain() is
  'Keeps Shopify launch readiness domain gate synchronized with the verified custom-domain cutover, even when no first-party Shopify provider refresh occurs.';
