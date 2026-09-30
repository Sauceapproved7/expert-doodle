-- Persist the commercial separation between the one-time Shopify Founding Pilot
-- and the owner-approval-gated monthly Studio subscription catalog.

update public.hercules_software_products
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'offer_architecture_version','studio-commercial-offer-map-v1',
  'founding_pilot_offer',jsonb_build_object(
    'channel','shopify',
    'billing_model','one_time',
    'price_cents',9900,
    'currency','USD',
    'product_id','gid://shopify/Product/15397259477312',
    'variant_id','gid://shopify/ProductVariant/67601341153600',
    'sku','SA-STUDIO-PILOT-001',
    'status','DRAFT',
    'separate_from_monthly_catalog',true
  ),
  'monthly_subscription_catalog',jsonb_build_array(
    jsonb_build_object('plan_code','starter','label','Starter','monthly_price_cents',2900),
    jsonb_build_object('plan_code','pro','label','Pro','monthly_price_cents',7900),
    jsonb_build_object('plan_code','agency','label','Business','monthly_price_cents',19900)
  ),
  'offer_equivalence',false,
  'automatic_plan_conversion',false,
  'commercial_separation_note','The $99 Shopify Founding Pilot is a separate one-time early-access offer. It is not the $29/$79/$199 monthly subscription catalog and does not approve or activate those plans.',
  'offer_map_aligned_at',now()
),
updated_at=now()
where code='sauceapproved-studio';
