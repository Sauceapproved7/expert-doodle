-- Align SauceApproved Studio commercial metadata with the verified live front door.
-- Checkout remains fail-closed; this migration does not approve pricing or enable billing.

update public.hercules_software_products
set live_url='https://sauceapproved-studio.onrender.com/',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'canonical_public_front_door','https://sauceapproved-studio.onrender.com/',
      'commercial_decision_issue','DA-39'
    ),
    updated_at=now()
where code='sauceapproved-studio'
  and checkout_enabled=false;

update public.hercules_software_product_plans
set label='Business',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'public_plan_label','Business',
      'internal_plan_code_preserved','agency'
    ),
    updated_at=now()
where product_code='sauceapproved-studio'
  and plan_code='agency'
  and checkout_enabled=false
  and pricing_status='owner_approval_required';
