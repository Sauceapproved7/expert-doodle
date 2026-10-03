create or replace function public.hercules_storefront_route()
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_domain record;
  v_custom_ready boolean := false;
begin
  select domain_name,status,ssl_status,metadata
    into v_domain
  from public.hercules_domains
  where domain_name='sauceapproved.com' and status <> 'removed'
  order by created_at desc
  limit 1;

  v_custom_ready :=
    coalesce(v_domain.status='active',false)
    and lower(coalesce(v_domain.ssl_status,'')) in ('active','enabled','valid','ready')
    and coalesce((v_domain.metadata->>'dns_ready_for_shopify')::boolean,false);

  if v_custom_ready then
    return jsonb_build_object('ok',true,'mode','custom_domain','url','https://sauceapproved.com','customDomainReady',true,'resolvedAt',now());
  end if;

  return jsonb_build_object('ok',true,'mode','fallback_myshopify','url','https://sauceapproved-2.myshopify.com','domain','sauceapproved-2.myshopify.com','preferredDomain','sauceapproved.com','customDomainReady',false,'resolvedAt',now());
end;
$$;

revoke all on function public.hercules_storefront_route() from public, anon, authenticated;
grant execute on function public.hercules_storefront_route() to service_role;

comment on function public.hercules_storefront_route() is
  'Returns only the canonical Shopify storefront until sauceapproved.com is active, DNS-ready, and SSL-ready.';
