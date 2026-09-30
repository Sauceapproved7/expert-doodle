-- Studio Founding Pilot no-self-payment launch gate v1
-- Prelaunch capability is sufficient to open the approved Shopify offer.
-- payment_path_verified remains a separate post-launch observation gate.

alter table public.hercules_software_commercial_approvals
  drop constraint if exists hercules_software_commercial_approvals_approval_type_check;

alter table public.hercules_software_commercial_approvals
  add constraint hercules_software_commercial_approvals_approval_type_check
  check (approval_type = any(array[
    'pricing'::text,
    'terms'::text,
    'privacy'::text,
    'payment_provider_ready'::text,
    'payment_launch_capability'::text,
    'payment_path_verified'::text
  ]));

insert into public.hercules_software_commercial_approvals(
  product_code,approval_type,status,document_ref,evidence
)
values (
  'sauceapproved-studio-founding-pilot',
  'payment_launch_capability',
  'pending',
  null,
  jsonb_build_object(
    'payment_provider','shopify',
    'required_checks',jsonb_build_array(
      'shopify_provider_ready',
      'exact_99_usd_draft_calculation',
      'read_all_orders',
      'read_orders',
      'write_orders',
      'write_checkouts',
      'refundCreate',
      'hercules_reconcile_verified_shopify_paid_order_v1'
    ),
    'owner_self_purchase_required',false,
    'post_launch_observation_required',true
  )
)
on conflict (product_code,approval_type) do update set
  evidence=excluded.evidence,
  updated_at=now();

update public.hercules_software_commercial_approvals
set status='pending',
    approved_by=null,
    approved_at=null,
    evidence=(coalesce(evidence,'{}'::jsonb)-'controlled_payment_verification')
      ||jsonb_build_object(
        'stage','post_launch_observation',
        'post_launch_observation_required',true,
        'first_real_customer_order',true,
        'owner_self_purchase_required',false,
        'required_checks',jsonb_build_array(
          'first_real_customer_order',
          'studio_entitlement_reconciliation',
          'payment_transaction_state',
          'payout_state_when_available'
        )
      ),
    updated_at=now()
where product_code='sauceapproved-studio-founding-pilot'
  and approval_type='payment_path_verified';

-- payment_path_verified pending: post_launch_observation

create or replace function public.hercules_studio_pilot_record_launch_capability(
  p_shop_gid text,
  p_shop_domain text,
  p_product_id text,
  p_variant_id text,
  p_sku text,
  p_amount_cents integer,
  p_currency text,
  p_product_status text,
  p_access_scopes jsonb,
  p_refund_api_supported boolean,
  p_entitlement_function_present boolean,
  p_draft_calculation_verified boolean,
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
  v_provider_ready boolean:=false;
  v_owner_ready boolean:=false;
  v_required_scopes text[]:=array[
    'read_all_orders',
    'read_orders',
    'write_orders',
    'write_checkouts'
  ];
  v_scope text;
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  select exists(
    select 1
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
      and approval_type='payment_provider_ready'
      and status='approved'
  ) into v_provider_ready;
  if not v_provider_ready then raise exception 'shopify_provider_not_ready'; end if;

  select count(*)=3 and bool_and(status='approved')
  into v_owner_ready
  from public.hercules_software_commercial_approvals
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type in ('pricing','terms','privacy');
  if not coalesce(v_owner_ready,false) then raise exception 'owner_commercial_approval_required'; end if;

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

  if trim(coalesce(p_product_id,''))<>'gid://shopify/Product/15397259477312'
     or trim(coalesce(p_variant_id,''))<>'gid://shopify/ProductVariant/67601341153600'
     or trim(coalesce(p_sku,''))<>'SA-STUDIO-PILOT-001' then
    raise exception 'studio_pilot_catalog_mismatch';
  end if;

  if p_amount_cents<>9900 or upper(trim(coalesce(p_currency,'')))<>'USD' then
    raise exception 'studio_pilot_price_mismatch';
  end if;

  if upper(trim(coalesce(p_product_status,''))) not in ('DRAFT','ACTIVE') then
    raise exception 'studio_pilot_product_status_invalid';
  end if;

  if p_access_scopes is null or jsonb_typeof(p_access_scopes)<>'array' then
    raise exception 'shopify_access_scopes_required';
  end if;

  foreach v_scope in array v_required_scopes loop
    if not (p_access_scopes ? v_scope) then
      raise exception 'shopify_scope_missing:%',v_scope;
    end if;
  end loop;

  if p_refund_api_supported is not true then
    raise exception 'refund_api_not_supported';
  end if;
  if p_entitlement_function_present is not true then
    raise exception 'entitlement_reconciliation_unavailable';
  end if;
  if p_draft_calculation_verified is not true then
    raise exception 'draft_calculation_not_verified';
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
        'product_id',trim(p_product_id),
        'variant_id',trim(p_variant_id),
        'sku',trim(p_sku),
        'amount_cents',p_amount_cents,
        'currency','USD',
        'product_status',upper(trim(p_product_status)),
        'verified_access_scopes',p_access_scopes,
        'refund_api','refundCreate',
        'refund_api_supported',true,
        'entitlement_reconciliation','hercules_reconcile_verified_shopify_paid_order_v1',
        'entitlement_function_present',true,
        'draft_calculation_verified',true,
        'owner_self_purchase_required',false,
        'charge_created',false,
        'order_created',false,
        'post_launch_observation_required',true,
        'verified_via','connected_shopify_admin_api_and_owned_runtime',
        'verified_at',v_now
      ),
      updated_at=v_now
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type='payment_launch_capability';

  if not found then raise exception 'studio_pilot_launch_capability_gate_missing'; end if;

  return jsonb_build_object(
    'ok',true,
    'product_code','sauceapproved-studio-founding-pilot',
    'payment_launch_capability','approved',
    'owner_self_purchase_required',false,
    'post_launch_observation_required',true,
    'verified_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_studio_pilot_record_launch_capability(
  text,text,text,text,text,integer,text,text,jsonb,boolean,boolean,boolean,timestamptz
) from public,anon,authenticated;
grant execute on function public.hercules_studio_pilot_record_launch_capability(
  text,text,text,text,text,integer,text,text,jsonb,boolean,boolean,boolean,timestamptz
) to service_role;

create or replace function public.hercules_studio_pilot_checkout_readiness()
returns jsonb
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  with approvals as (
    select approval_type,status,evidence
    from public.hercules_software_commercial_approvals
    where product_code='sauceapproved-studio-founding-pilot'
  ),
  product as (
    select checkout_enabled
    from public.hercules_software_products
    where code='sauceapproved-studio-founding-pilot'
  ),
  launch_gate as (
    select count(*)=5 and bool_and(status='approved') as ready
    from approvals
    where approval_type in (
      'pricing','terms','privacy','payment_provider_ready','payment_launch_capability'
    )
  )
  select jsonb_build_object(
    'product_code','sauceapproved-studio-founding-pilot',
    'checkout_enabled',coalesce((select checkout_enabled from product),false),
    'approvals',coalesce(
      (select jsonb_object_agg(approval_type,status) from approvals),
      '{}'::jsonb
    ),
    'ready',coalesce((select ready from launch_gate),false),
    'post_launch_observation',coalesce(
      (select jsonb_build_object(
        'status',status,
        'required',true,
        'first_real_customer_order',true
      )
      from approvals where approval_type='payment_path_verified'),
      jsonb_build_object('status','pending','required',true,'first_real_customer_order',true)
    )
  );
$function$;

revoke all on function public.hercules_studio_pilot_checkout_readiness()
  from public,anon,authenticated;
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
        'pricing','terms','privacy','payment_provider_ready','payment_launch_capability'
      );
    if not coalesce(v_ready,false) then
      raise exception 'studio_pilot_launch_gates_required';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.hercules_activate_studio_pilot_checkout()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_ready boolean:=false;
  v_result jsonb;
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  select count(*)=5 and bool_and(status='approved')
  into v_ready
  from public.hercules_software_commercial_approvals
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type in (
      'pricing','terms','privacy','payment_provider_ready','payment_launch_capability'
    );

  if not coalesce(v_ready,false) then
    raise exception 'studio_pilot_launch_gates_required';
  end if;

  update public.hercules_software_products
  set checkout_enabled=true,
      status='early_access',
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'payment_launch_capability','approved',
        'owner_self_purchase_required',false,
        'post_launch_observation_required',true,
        'post_launch_observation_gate','payment_path_verified',
        'first_real_customer_order',true,
        'launch_gate_version','studio-pilot-no-self-payment-v1',
        'activated_at',now()
      ),
      updated_at=now()
  where code='sauceapproved-studio-founding-pilot';

  select public.hercules_studio_pilot_checkout_readiness() into v_result;
  return v_result;
end;
$function$;

revoke all on function public.hercules_activate_studio_pilot_checkout()
  from public,anon,authenticated;
grant execute on function public.hercules_activate_studio_pilot_checkout()
  to service_role;

-- payment_launch_capability approved is required before checkout_enabled=true.
-- No owner self-purchase is required; live observation begins with the first real customer order.
