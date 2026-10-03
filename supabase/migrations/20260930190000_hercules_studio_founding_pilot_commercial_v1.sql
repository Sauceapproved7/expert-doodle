-- SauceApproved Studio Founding Pilot commercial approval v1
-- Separate $99 one-time Shopify offer. Does not approve or activate monthly Studio subscriptions.

insert into public.hercules_software_products(
  code,name,descriptor,status,live_url,checkout_enabled,metadata
)
values (
  'sauceapproved-studio-founding-pilot',
  'SauceApproved Studio — Founding Pilot Access',
  'One-time pre-production founding-pilot access to SauceApproved Studio',
  'early_access',
  null,
  false,
  jsonb_build_object(
    'owned_lane',true,
    'commercial_mode','founding_pilot_one_time',
    'billing_model','one_time',
    'payment_provider','shopify',
    'candidate_price_cents',9900,
    'currency','USD',
    'shop_domain','sauceapproved-2.myshopify.com',
    'shopify_product_id','gid://shopify/Product/15397259477312',
    'shopify_variant_id','gid://shopify/ProductVariant/67601341153600',
    'shopify_sku','SA-STUDIO-PILOT-001',
    'entitlement_product_code','sauceapproved-studio',
    'soundworld_launch_gift','hercules-soundworld-launch-gift-v1',
    'commercial_packet_version','sauceapproved-studio-founding-pilot-commercial-v1',
    'commercial_packet_digest','edb61c9817f34f6445172a2d88f71def13be873870f401ff4bf17f008d2734ab',
    'separate_from_monthly_catalog',true,
    'automatic_plan_conversion',false
  )
)
on conflict (code) do update set
  name=excluded.name,
  descriptor=excluded.descriptor,
  status='early_access',
  checkout_enabled=false,
  metadata=excluded.metadata,
  updated_at=now();

insert into public.hercules_software_commercial_approvals(
  product_code,approval_type,status,document_ref,evidence
)
select
  'sauceapproved-studio-founding-pilot',
  a.approval_type,
  'pending',
  case a.approval_type
    when 'terms' then 'docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-TERMS-CANDIDATE-V1.md'
    when 'privacy' then 'docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-PRIVACY-CANDIDATE-V1.md'
    else null
  end,
  case a.approval_type
    when 'pricing' then jsonb_build_object(
      'currency','USD',
      'billing_model','one_time',
      'payment_provider','shopify',
      'candidate_price_cents',9900,
      'commercial_packet_version','sauceapproved-studio-founding-pilot-commercial-v1',
      'commercial_packet_digest','edb61c9817f34f6445172a2d88f71def13be873870f401ff4bf17f008d2734ab',
      'owner_approval_required',true
    )
    when 'terms' then jsonb_build_object(
      'terms_sha','7a524ec1240a08c88ac85e88eeb02fe8e8781814',
      'covers',jsonb_build_array(
        'one_time_price','entitlement','delivery','pre_production_limitations',
        'refund_and_cancellation','soundworld_launch_gift','general_terms'
      ),
      'owner_approval_required',true
    )
    when 'privacy' then jsonb_build_object(
      'privacy_sha','c8b676fef1e8ab2a4b2052d0e9befd447819c9f7',
      'payment_provider','shopify',
      'owner_approval_required',true
    )
    when 'payment_provider_ready' then jsonb_build_object(
      'payment_provider','shopify',
      'required_shop_domain','sauceapproved-2.myshopify.com',
      'required_checkoutApiSupported',true,
      'required_setupRequired',false,
      'owner_approval_required',false
    )
    when 'payment_path_verified' then jsonb_build_object(
      'payment_provider','shopify',
      'required_checks',jsonb_build_array(
        'real_paid_order','refund_or_reversal_capability','payout_state',
        'studio_entitlement_reconciliation'
      ),
      'owner_approval_required',false
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
  document_ref=excluded.document_ref,
  evidence=coalesce(public.hercules_software_commercial_approvals.evidence,'{}'::jsonb)||excluded.evidence,
  updated_at=now();

create or replace function public.hercules_studio_pilot_owner_approve_bundle(
  p_user_id uuid,
  p_packet_version text,
  p_packet_digest text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid:=p_user_id;
  v_is_owner boolean:=false;
  v_expected_version constant text:='sauceapproved-studio-founding-pilot-commercial-v1';
  v_expected_digest constant text:='edb61c9817f34f6445172a2d88f71def13be873870f401ff4bf17f008d2734ab';
  v_expected_confirmation constant text:='APPROVE SAUCEAPPROVED STUDIO FOUNDING PILOT EDB61C9817F3';
  v_now timestamptz:=now();
  v_product public.hercules_software_products%rowtype;
  v_count integer:=0;
begin
  if v_uid is null then raise exception 'owner_identity_required'; end if;

  select exists(
    select 1
    from public.hercules_memberships
    where organization_id='ea5fb196-67f9-42fa-b592-49eeb3b84346'
      and user_id=v_uid
      and status='active'
      and role='owner'
  ) into v_is_owner;
  if not v_is_owner then raise exception 'owner_access_required'; end if;

  if p_packet_version is distinct from v_expected_version then
    raise exception 'studio_pilot_packet_version_mismatch';
  end if;
  if p_packet_digest is distinct from v_expected_digest then
    raise exception 'studio_pilot_packet_digest_mismatch';
  end if;
  if p_confirmation is distinct from v_expected_confirmation then
    raise exception 'confirmation_phrase_mismatch';
  end if;

  select * into v_product
  from public.hercules_software_products
  where code='sauceapproved-studio-founding-pilot';

  if not found then raise exception 'studio_pilot_product_missing'; end if;
  if v_product.checkout_enabled is true then
    raise exception 'studio_pilot_checkout_must_remain_closed_during_owner_approval';
  end if;

  if coalesce(v_product.metadata->>'commercial_mode','')<>'founding_pilot_one_time'
     or coalesce(v_product.metadata->>'billing_model','')<>'one_time'
     or coalesce(v_product.metadata->>'payment_provider','')<>'shopify'
     or coalesce((v_product.metadata->>'candidate_price_cents')::integer,0)<>9900
     or coalesce(v_product.metadata->>'shopify_product_id','')<>'gid://shopify/Product/15397259477312'
     or coalesce(v_product.metadata->>'shopify_variant_id','')<>'gid://shopify/ProductVariant/67601341153600'
     or coalesce(v_product.metadata->>'shopify_sku','')<>'SA-STUDIO-PILOT-001' then
    raise exception 'studio_pilot_catalog_mismatch';
  end if;

  if exists(
    select 1
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
      and approval_type='terms'
      and (
        coalesce(document_ref,'')<>'docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-TERMS-CANDIDATE-V1.md'
        or coalesce(evidence->>'terms_sha','')<>'7a524ec1240a08c88ac85e88eeb02fe8e8781814'
      )
  ) then raise exception 'studio_pilot_terms_document_mismatch'; end if;

  if exists(
    select 1
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
      and approval_type='privacy'
      and (
        coalesce(document_ref,'')<>'docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-PRIVACY-CANDIDATE-V1.md'
        or coalesce(evidence->>'privacy_sha','')<>'c8b676fef1e8ab2a4b2052d0e9befd447819c9f7'
      )
  ) then raise exception 'studio_pilot_privacy_document_mismatch'; end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=v_uid,
      approved_at=v_now,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'commercial_packet_version',v_expected_version,
        'commercial_packet_digest',v_expected_digest,
        'confirmation_phrase',v_expected_confirmation,
        'approved_via','hercules_studio_pilot_owner_approve_bundle'
      ),
      updated_at=v_now
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type in ('pricing','terms','privacy');

  get diagnostics v_count=row_count;
  if v_count<>3 then raise exception 'studio_pilot_owner_approval_rows_incomplete'; end if;

  return jsonb_build_object(
    'ok',true,
    'product_code','sauceapproved-studio-founding-pilot',
    'packet_version',v_expected_version,
    'packet_digest',v_expected_digest,
    'owner_approvals',jsonb_build_array('pricing','terms','privacy'),
    'monthly_catalog_unchanged',true,
    'payment_gates_unchanged',true,
    'shopify_product_status_unchanged',true,
    'approved_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_studio_pilot_owner_approve_bundle(uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.hercules_studio_pilot_owner_approve_bundle(uuid,text,text,text)
  to service_role;

create or replace function public.hercules_studio_pilot_record_shopify_provider_ready(
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
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  if lower(trim(coalesce(p_shop_domain,'')))<>'sauceapproved-2.myshopify.com' then
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
        'shop_domain',lower(trim(p_shop_domain)),
        'setupRequired',p_setup_required,
        'checkoutApiSupported',p_checkout_api_supported,
        'supportedDigitalWallets',coalesce(p_wallets,'[]'::jsonb),
        'verified_via','connected_shopify_admin_api',
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
    'shop_domain',lower(trim(p_shop_domain)),
    'verified_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_studio_pilot_record_shopify_provider_ready(text,boolean,boolean,jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function public.hercules_studio_pilot_record_shopify_provider_ready(text,boolean,boolean,jsonb,timestamptz)
  to service_role;

create or replace function public.hercules_studio_pilot_record_shopify_payment_path(
  p_shop_domain text,
  p_real_order_id text,
  p_refund_or_reversal_reference text,
  p_payout_reference text,
  p_entitlement_evidence jsonb,
  p_verified_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_now timestamptz:=coalesce(p_verified_at,now());
  v_provider_ready boolean:=false;
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  if lower(trim(coalesce(p_shop_domain,'')))<>'sauceapproved-2.myshopify.com' then
    raise exception 'shop_domain_mismatch';
  end if;
  if nullif(trim(coalesce(p_real_order_id,'')),'') is null then
    raise exception 'real_order_id_required';
  end if;
  if nullif(trim(coalesce(p_refund_or_reversal_reference,'')),'') is null then
    raise exception 'refund_or_reversal_reference_required';
  end if;
  if nullif(trim(coalesce(p_payout_reference,'')),'') is null then
    raise exception 'payout_reference_required';
  end if;
  if p_entitlement_evidence is null
     or jsonb_typeof(p_entitlement_evidence)<>'object'
     or p_entitlement_evidence='{}'::jsonb then
    raise exception 'entitlement_evidence_required';
  end if;

  select exists(
    select 1
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
      and approval_type='payment_provider_ready'
      and status='approved'
  ) into v_provider_ready;
  if not v_provider_ready then raise exception 'shopify_provider_not_ready'; end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=null,
      approved_at=v_now,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'payment_provider','shopify',
        'shop_domain',lower(trim(p_shop_domain)),
        'real_paid_order_id',trim(p_real_order_id),
        'refund_or_reversal_reference',trim(p_refund_or_reversal_reference),
        'payout_reference',trim(p_payout_reference),
        'studio_entitlement_reconciliation',p_entitlement_evidence,
        'verified_via','connected_shopify_admin_api_and_owned_entitlement_evidence',
        'verified_at',v_now
      ),
      updated_at=v_now
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type='payment_path_verified';

  if not found then raise exception 'studio_pilot_payment_path_gate_missing'; end if;

  return jsonb_build_object(
    'ok',true,
    'product_code','sauceapproved-studio-founding-pilot',
    'payment_provider','shopify',
    'payment_path_verified',true,
    'verified_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_studio_pilot_record_shopify_payment_path(text,text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function public.hercules_studio_pilot_record_shopify_payment_path(text,text,text,text,jsonb,timestamptz)
  to service_role;

create or replace function public.hercules_studio_pilot_checkout_readiness()
returns jsonb
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  with approvals as (
    select approval_type,status
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
  ),
  product as (
    select checkout_enabled
    from public.hercules_software_products
    where code='sauceapproved-studio-founding-pilot'
  )
  select jsonb_build_object(
    'product_code','sauceapproved-studio-founding-pilot',
    'checkout_enabled',coalesce((select checkout_enabled from product),false),
    'approvals',coalesce(
      (select jsonb_object_agg(approval_type,status) from approvals),
      '{}'::jsonb
    ),
    'ready',(
      select count(*)=5 and bool_and(status='approved')
      from approvals
      where approval_type in (
        'pricing','terms','privacy','payment_provider_ready','payment_path_verified'
      )
    )
  );
$function$;

revoke all on function public.hercules_studio_pilot_checkout_readiness()
  from public, anon, authenticated;
grant execute on function public.hercules_studio_pilot_checkout_readiness()
  to service_role;

create or replace function public.hercules_guard_studio_pilot_checkout()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_ready boolean:=false;
begin
  if new.code='sauceapproved-studio-founding-pilot'
     and new.checkout_enabled is true
     and coalesce(old.checkout_enabled,false) is false then
    select count(*)=5 and bool_and(status='approved')
    into v_ready
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
      and approval_type in (
        'pricing','terms','privacy','payment_provider_ready','payment_path_verified'
      );
    if not coalesce(v_ready,false) then
      raise exception 'studio_pilot_commercial_and_payment_gates_required';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists hercules_guard_studio_pilot_checkout_trigger
  on public.hercules_software_products;
create trigger hercules_guard_studio_pilot_checkout_trigger
before update of checkout_enabled on public.hercules_software_products
for each row execute function public.hercules_guard_studio_pilot_checkout();

update public.hercules_software_products
set checkout_enabled=false,updated_at=now()
where code='sauceapproved-studio-founding-pilot';
