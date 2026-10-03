-- Bounded reconciliation for verified Shopify paid orders when native webhook delivery is unavailable.
-- The caller must obtain order facts from the connected Shopify Admin API. No customer-supplied payment claim is accepted.

create or replace function public.hercules_reconcile_verified_shopify_paid_order_v1(
  p_shop_domain text,
  p_order_id text,
  p_line_item_id text,
  p_product_id text,
  p_variant_id text,
  p_sku text,
  p_quantity integer,
  p_buyer_email_sha256 text,
  p_processed_at timestamptz,
  p_amount_cents bigint,
  p_currency text,
  p_payment_settled boolean,
  p_test boolean,
  p_cancelled boolean,
  p_source text default 'connected_shopify_admin_api'
)
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_product_code text;
  v_plan_code text;
  v_entitlement_version text;
  v_entitlement_key text;
  v_existing public.hercules_studio_purchase_entitlements%rowtype;
  v_gift jsonb;
  v_purchase_key text;
  v_source_event_id text;
  v_prior_jwt_claims text;
  v_impersonated_service_role boolean := false;
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if lower(trim(coalesce(p_shop_domain,''))) <> 'sauceapproved-2.myshopify.com' then
    return jsonb_build_object('ok',false,'reconciled',false,'reason','shop_domain_mismatch');
  end if;
  if nullif(trim(coalesce(p_order_id,'')),'') is null then
    raise exception 'order_id_required';
  end if;
  if p_payment_settled is not true then
    return jsonb_build_object('ok',false,'reconciled',false,'reason','payment_not_settled');
  end if;
  if p_test is true then
    return jsonb_build_object('ok',false,'reconciled',false,'reason','test_order_not_eligible');
  end if;
  if p_cancelled is true then
    return jsonb_build_object('ok',false,'reconciled',false,'reason','cancelled_order_not_eligible');
  end if;
  if p_processed_at is null then
    raise exception 'processed_at_required';
  end if;
  if coalesce(p_quantity,0) < 1 or p_quantity > 100 then
    raise exception 'invalid_quantity';
  end if;
  if lower(trim(coalesce(p_buyer_email_sha256,''))) !~ '^[a-f0-9]{64}$' then
    raise exception 'buyer_email_sha256_invalid';
  end if;
  if coalesce(p_amount_cents,-1) < 0 then
    raise exception 'amount_cents_invalid';
  end if;
  if upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then
    raise exception 'currency_invalid';
  end if;
  if trim(coalesce(p_source,'')) <> 'connected_shopify_admin_api' then
    raise exception 'untrusted_reconciliation_source';
  end if;

  if trim(coalesce(p_product_id,''))='15397259477312'
     and trim(coalesce(p_variant_id,''))='67601341153600'
     and trim(coalesce(p_sku,''))='SA-STUDIO-PILOT-001' then
    v_product_code := 'sauceapproved-studio';
    v_plan_code := 'founding-pilot';
    v_entitlement_version := 'studio-shopify-founding-pilot-v1';
  elsif trim(coalesce(p_product_id,''))='10261114782016'
     and trim(coalesce(p_variant_id,''))='53144447811904'
     and trim(coalesce(p_sku,''))='HERCULES-TITAN-FOUNDING' then
    v_product_code := 'hercules-titan-founding-access';
    v_plan_code := 'founding-access';
    v_entitlement_version := 'titan-shopify-founding-access-v1';
  else
    return jsonb_build_object('ok',true,'reconciled',false,'reason','line_item_not_eligible');
  end if;

  v_entitlement_key := encode(
    digest(
      concat_ws('|',
        v_entitlement_version,
        'shopify',
        'sauceapproved-2.myshopify.com',
        trim(p_order_id),
        trim(p_product_id),
        trim(p_variant_id),
        trim(p_sku)
      ),
      'sha256'
    ),
    'hex'
  );

  v_source_event_id := 'reconcile:' || trim(p_order_id) || ':' || coalesce(nullif(trim(coalesce(p_line_item_id,'')),''),trim(p_variant_id));

  insert into public.hercules_studio_purchase_entitlements(
    entitlement_key,
    provider,
    shop_domain,
    provider_order_id,
    provider_line_item_id,
    product_code,
    product_id,
    variant_id,
    sku,
    quantity,
    buyer_email_sha256,
    status,
    source_webhook_id,
    currency,
    paid_total,
    metadata
  )
  values(
    v_entitlement_key,
    'shopify',
    'sauceapproved-2.myshopify.com',
    trim(p_order_id),
    nullif(trim(coalesce(p_line_item_id,'')),''),
    v_product_code,
    trim(p_product_id),
    trim(p_variant_id),
    trim(p_sku),
    p_quantity,
    lower(trim(p_buyer_email_sha256)),
    'paid_pending_claim',
    v_source_event_id,
    upper(trim(p_currency)),
    (p_amount_cents::numeric/100)::text,
    jsonb_build_object(
      'entitlement_version',v_entitlement_version,
      'plan_code',v_plan_code,
      'source','connected_shopify_admin_api_reconciliation',
      'verified_by_connected_shopify_api',true,
      'native_webhook',false,
      'raw_email_stored',false,
      'reconciliation_version','v1'
    )
  )
  on conflict (shop_domain,provider_order_id,variant_id,sku) do nothing;

  select *
  into v_existing
  from public.hercules_studio_purchase_entitlements
  where shop_domain='sauceapproved-2.myshopify.com'
    and provider_order_id=trim(p_order_id)
    and variant_id=trim(p_variant_id)
    and sku=trim(p_sku)
  limit 1;

  if v_existing.id is null then
    raise exception 'entitlement_reconciliation_failed';
  end if;

  v_purchase_key := concat_ws(':',
    'shopify',
    'sauceapproved-2.myshopify.com',
    trim(p_order_id),
    v_product_code,
    coalesce(nullif(trim(coalesce(p_line_item_id,'')),''),trim(p_sku))
  );

  -- The existing SoundWorld recorder self-checks auth.jwt(). The SQL-admin reconciliation
  -- path runs as Postgres, which is already more privileged than service_role. Set only the
  -- transaction-local JWT claim while invoking that existing recorder, then restore it.
  if current_user='postgres' and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    v_prior_jwt_claims := current_setting('request.jwt.claims',true);
    perform set_config('request.jwt.claims','{"role":"service_role"}',true);
    v_impersonated_service_role := true;
  end if;

  begin
    v_gift := public.hercules_soundworld_record_purchase_eligibility(
    p_purchase_key => v_purchase_key,
    p_provider => 'shopify',
    p_provider_object_id => trim(p_order_id),
    p_product_code => v_product_code,
    p_organization_id => null,
    p_user_id => null,
    p_buyer_email_sha256 => lower(trim(p_buyer_email_sha256)),
    p_purchased_at => p_processed_at,
    p_amount_cents => p_amount_cents,
    p_currency => upper(trim(p_currency)),
    p_payment_settled => true,
    p_verification_purchase => false,
    p_source_event_id => v_source_event_id,
    p_metadata => jsonb_build_object(
      'source','connected_shopify_admin_api_reconciliation',
      'shop_domain','sauceapproved-2.myshopify.com',
      'sku',trim(p_sku),
      'raw_email_stored',false,
      'native_webhook',false
    )
  );
  exception when others then
    if v_impersonated_service_role then
      perform set_config('request.jwt.claims',coalesce(v_prior_jwt_claims,''),true);
    end if;
    raise;
  end;

  if v_impersonated_service_role then
    perform set_config('request.jwt.claims',coalesce(v_prior_jwt_claims,''),true);
  end if;

  return jsonb_build_object(
    'ok',true,
    'reconciled',true,
    'product_code',v_product_code,
    'entitlement_key',v_existing.entitlement_key,
    'entitlement_status',v_existing.status,
    'soundworld_gift',v_gift
  );
end;
$$;

revoke all on function public.hercules_reconcile_verified_shopify_paid_order_v1(
  text,text,text,text,text,text,integer,text,timestamptz,bigint,text,boolean,boolean,boolean,text
) from public,anon,authenticated;

grant execute on function public.hercules_reconcile_verified_shopify_paid_order_v1(
  text,text,text,text,text,text,integer,text,timestamptz,bigint,text,boolean,boolean,boolean,text
) to service_role;
