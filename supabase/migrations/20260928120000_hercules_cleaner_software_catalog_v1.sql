-- Hercules Cleaner software catalog v1
-- Adds Cleaner as an Early Access product while preserving owner-controlled commercial gates.

insert into public.hercules_software_products(
  code,name,descriptor,status,live_url,checkout_enabled,metadata
)
values (
  'hercules-cleaner',
  'Hercules Cleaner',
  'Recoverable Computer Maintenance',
  'early_access',
  null,
  false,
  jsonb_build_object(
    'owned_lane',true,
    'commercial_mode','founding_access',
    'delivery_mode','local_agent_with_web_commerce',
    'canonical_core','hercules-cleaner/',
    'release','hercules-cleaner-v1.0.0',
    'offer_source','hercules-forge/offers/hercules-cleaner/index.html',
    'session_clean',true,
    'recovery_capsules',true
  )
)
on conflict (code) do update set
  name=excluded.name,
  descriptor=excluded.descriptor,
  status='early_access',
  live_url=excluded.live_url,
  checkout_enabled=false,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.hercules_software_product_plans(
  product_code,plan_code,label,candidate_monthly_price_cents,
  pricing_status,checkout_enabled,entitlements,metadata
)
values
(
  'hercules-cleaner','starter','Starter',2900,'owner_approval_required',false,
  '["manual_clean","quick_safe_profile","recovery_capsules","cleanup_receipts"]'::jsonb,
  '{"audience":"personal computers and solo operators"}'::jsonb
),
(
  'hercules-cleaner','pro','Pro',7900,'owner_approval_required',false,
  '["starter_features","session_clean","custom_schedules","low_storage_guard","extended_recovery_retention"]'::jsonb,
  '{"audience":"power users, creators and developers"}'::jsonb
),
(
  'hercules-cleaner','agency','Agency',19900,'owner_approval_required',false,
  '["pro_features","multi_device_policy","centralized_receipts","policy_templates","higher_device_limits"]'::jsonb,
  '{"audience":"teams and managed-device operators","future_entitlements_are_not_claimed_as_shipped":true}'::jsonb
)
on conflict (product_code,plan_code) do update set
  label=excluded.label,
  candidate_monthly_price_cents=excluded.candidate_monthly_price_cents,
  pricing_status='owner_approval_required',
  checkout_enabled=false,
  entitlements=excluded.entitlements,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.hercules_software_commercial_approvals(
  product_code,approval_type,status,document_ref,evidence
)
select
  'hercules-cleaner',
  a.approval_type,
  'pending',
  case a.approval_type
    when 'terms' then 'docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md'
    when 'privacy' then 'docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md'
    else null
  end,
  case a.approval_type
    when 'pricing' then jsonb_build_object(
      'currency','USD',
      'interval','month',
      'starter_cents',2900,
      'pro_cents',7900,
      'agency_cents',19900,
      'owner_approval_required',true
    )
    when 'payment_provider_ready' then jsonb_build_object(
      'required_custody','hercules-owned',
      'owner_approval_required',true
    )
    when 'payment_path_verified' then jsonb_build_object(
      'required_checks',jsonb_build_array(
        'checkout','subscription_state','webhook','cancellation',
        'refund_or_reversal','entitlement_sync'
      )
    )
    else '{}'::jsonb
  end
from (
  values
    ('pricing'),
    ('terms'),
    ('privacy'),
    ('payment_provider_ready'),
    ('payment_path_verified')
) as a(approval_type)
on conflict (product_code,approval_type) do update set
  status='pending',
  approved_by=null,
  approved_at=null,
  document_ref=excluded.document_ref,
  evidence=excluded.evidence,
  updated_at=now();

-- Explicit fail-closed reinforcement for catalog preparation.
update public.hercules_software_products
set checkout_enabled=false,updated_at=now()
where code='hercules-cleaner';

update public.hercules_software_product_plans
set checkout_enabled=false,pricing_status='owner_approval_required',updated_at=now()
where product_code='hercules-cleaner';
