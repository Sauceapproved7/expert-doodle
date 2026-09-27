revoke all on function public.hercules_sync_shopify_launch_readiness_from_domain()
  from public, anon, authenticated;

revoke all on function public.hercules_sync_storefront_smoke_to_launch_readiness()
  from public, anon, authenticated;

grant execute on function public.hercules_sync_shopify_launch_readiness_from_domain()
  to service_role;

grant execute on function public.hercules_sync_storefront_smoke_to_launch_readiness()
  to service_role;

comment on function public.hercules_sync_shopify_launch_readiness_from_domain() is
  'Trigger-only launch-readiness sync. Direct execution is restricted to service_role; anon/authenticated cannot invoke it through RPC.';

comment on function public.hercules_sync_storefront_smoke_to_launch_readiness() is
  'Trigger-only storefront-readiness sync. Direct execution is restricted to service_role; anon/authenticated cannot invoke it through RPC.';
