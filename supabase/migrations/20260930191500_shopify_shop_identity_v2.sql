-- Shopify Shop identity v2
-- Trust the immutable SauceApproved Shopify Shop GID and accept only verified aliases for that same shop.

update public.hercules_software_products
set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
  'shop_gid','gid://shopify/Shop/100002726208',
  'shop_domain','sauceapproved-2.myshopify.com',
  'shop_domains',jsonb_build_array(
    'sauceapproved-2.myshopify.com',
    'azymhc-x0.myshopify.com',
    'sauceapproved-3.myshopify.com'
  ),
  'shop_identity_version','shopify-shop-identity-v2'
),
updated_at=now()
where code='sauceapproved-studio-founding-pilot';

drop function if exists public.hercules_studio_pilot_record_shopify_provider_ready(
  text,boolean,boolean,jsonb,timestamptz
);

create or replace function public.hercules_studio_pilot_record_shopify_provider_ready(
  p_shop_gid text,
  p_shop_domain text,
  p_setup_required boolean,
  p_checkout_api_supported boolean,
  p_wallets jsonb,
  p_verified_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_now timestamptz:=coalesce(p_verified_at,now());
  v_domain text:=lower(trim(coalesce(p_shop_domain,'')));
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  if trim(coalesce(p_shop_gid,''))<>'gid://shopify/Shop/100002726208' then
    raise exception 'shop_gid_mismatch';
  end if;

  if v_domain not in (
    'sauceapproved-2.myshopify.com',
    'azymhc-x0.myshopify.com',
    'sauceapproved-3.myshopify.com'
  ) then
    raise exception 'shop_domain_mismatch';
  end if;

  if p_setup_required is not false then
    raise exception 'shopify_setup_required';
  end if;
  if p_checkout_api_supported is not true then
    raise exception 'shopify_checkout_api_not_supported';
  end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=null,
      approved_at=v_now,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'payment_provider','shopify',
        'shop_gid',trim(p_shop_gid),
        'source_shop_domain',v_domain,
        'canonical_shop_domain','sauceapproved-2.myshopify.com',
        'setupRequired',p_setup_required,
        'checkoutApiSupported',p_checkout_api_supported,
        'supportedDigitalWallets',coalesce(p_wallets,'[]'::jsonb),
        'verified_via','connected_shopify_admin_api',
        'shop_identity_version','shopify-shop-identity-v2',
        'verified_at',v_now
      ),
      updated_at=v_now
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type='payment_provider_ready';

  if not found then raise exception 'studio_pilot_provider_gate_missing'; end if;

  return jsonb_build_object(
    'ok',true,
    'product_code','sauceapproved-studio-founding-pilot',
    'payment_provider','shopify',
    'payment_provider_ready',true,
    'shop_gid',trim(p_shop_gid),
    'source_shop_domain',v_domain,
    'canonical_shop_domain','sauceapproved-2.myshopify.com',
    'verified_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_studio_pilot_record_shopify_provider_ready(
  text,text,boolean,boolean,jsonb,timestamptz
) from public, anon, authenticated;

grant execute on function public.hercules_studio_pilot_record_shopify_provider_ready(
  text,text,boolean,boolean,jsonb,timestamptz
) to service_role;
