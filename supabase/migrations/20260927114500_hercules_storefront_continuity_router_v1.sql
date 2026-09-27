create or replace function public.hercules_storefront_route()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_domain record;
  v_fallback_domain text;
  v_custom_ready boolean := false;
  v_now timestamptz := now();
begin
  select domain_name,status,ssl_status,primary_target_id,metadata,updated_at
    into v_domain
  from public.hercules_domains
  where domain_name='sauceapproved.com'
    and status <> 'removed'
  order by created_at desc
  limit 1;

  v_fallback_domain := lower(coalesce(
    nullif(v_domain.metadata->>'shopify_current_primary_domain',''),
    nullif(v_domain.primary_target_id,''),
    'sauceapproved-2.myshopify.com'
  ));

  if not ends_with(lower(v_fallback_domain),'.myshopify.com') then
    v_fallback_domain := 'sauceapproved-2.myshopify.com';
  end if;

  v_custom_ready :=
    coalesce(v_domain.status='active',false)
    and lower(coalesce(v_domain.ssl_status,'')) in ('active','enabled','valid','ready')
    and coalesce((v_domain.metadata->>'dns_ready_for_shopify')::boolean,false);

  if v_custom_ready then
    return jsonb_build_object(
      'ok',true,
      'mode','custom_domain',
      'url','https://sauceapproved.com',
      'domain','sauceapproved.com',
      'fallbackDomain',v_fallback_domain,
      'customDomainReady',true,
      'resolvedAt',v_now
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'mode','fallback_myshopify',
    'url','https://' || v_fallback_domain,
    'domain',v_fallback_domain,
    'preferredDomain','sauceapproved.com',
    'customDomainReady',false,
    'resolvedAt',v_now
  );
end;
$$;

revoke all on function public.hercules_storefront_route() from public, anon, authenticated;
grant execute on function public.hercules_storefront_route() to service_role;

comment on function public.hercules_storefront_route() is
  'Returns the current safe SauceApproved storefront target: verified Shopify fallback until the custom domain is active, DNS-ready, and SSL-ready.';
