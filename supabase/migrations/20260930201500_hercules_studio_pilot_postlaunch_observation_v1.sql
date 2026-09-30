-- Studio Founding Pilot post-launch observation v1
-- Real customer orders are observed, not refunded for verification.

create or replace function public.hercules_studio_pilot_record_post_launch_observation(
  p_shop_domain text,
  p_real_paid_order_id text,
  p_transaction_reference text,
  p_entitlement_evidence jsonb,
  p_payout_state text,
  p_payout_reference text default null,
  p_observed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_now timestamptz:=coalesce(p_observed_at,now());
  v_domain text:=lower(trim(coalesce(p_shop_domain,'')));
  v_payout_state text:=lower(trim(coalesce(p_payout_state,'')));
  v_successful_payout boolean:=false;
  v_status text:='pending';
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  if v_domain not in (
    'sauceapproved-2.myshopify.com',
    'azymhc-x0.myshopify.com',
    'sauceapproved-3.myshopify.com'
  ) then
    raise exception 'shop_domain_mismatch';
  end if;

  if nullif(trim(coalesce(p_real_paid_order_id,'')),'') is null then
    raise exception 'real_paid_order_id_required';
  end if;

  if nullif(trim(coalesce(p_transaction_reference,'')),'') is null then
    raise exception 'transaction_reference_required';
  end if;

  if p_entitlement_evidence is null
     or jsonb_typeof(p_entitlement_evidence)<>'object'
     or p_entitlement_evidence='{}'::jsonb then
    raise exception 'entitlement_evidence_required';
  end if;

  if v_payout_state='' then
    raise exception 'payout_state_required';
  end if;

  v_successful_payout := v_payout_state in (
    'paid',
    'deposited',
    'completed',
    'succeeded'
  );

  if v_successful_payout
     and nullif(trim(coalesce(p_payout_reference,'')),'') is null then
    raise exception 'payout_reference_required_for_completed_payout';
  end if;

  if v_successful_payout then
    v_status:='approved';
  end if;

  update public.hercules_software_commercial_approvals
  set status=v_status,
      approved_by=null,
      approved_at=case when v_status='approved' then v_now else null end,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'payment_provider','shopify',
        'shop_domain',v_domain,
        'first_real_customer_order',true,
        'real_paid_order_id',trim(p_real_paid_order_id),
        'transaction_reference',trim(p_transaction_reference),
        'studio_entitlement_reconciliation',p_entitlement_evidence,
        'payout_state',v_payout_state,
        'payout_reference',nullif(trim(coalesce(p_payout_reference,'')),''),
        'refund_required',false,
        'customer_purchase_preserved',true,
        'post_launch_observation_required',not v_successful_payout,
        'verified_via','connected_shopify_admin_api_and_owned_entitlement_evidence',
        'observed_at',v_now
      ),
      updated_at=v_now
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type='payment_path_verified';

  if not found then
    raise exception 'studio_pilot_payment_path_gate_missing';
  end if;

  return jsonb_build_object(
    'ok',true,
    'product_code','sauceapproved-studio-founding-pilot',
    'payment_path_verified',v_status,
    'first_real_customer_order',true,
    'refund_required',false,
    'payout_state',v_payout_state,
    'observed_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_studio_pilot_record_post_launch_observation(
  text,text,text,jsonb,text,text,timestamptz
) from public,anon,authenticated;

grant execute on function public.hercules_studio_pilot_record_post_launch_observation(
  text,text,text,jsonb,text,text,timestamptz
) to service_role;

comment on function public.hercules_studio_pilot_record_post_launch_observation(
  text,text,text,jsonb,text,text,timestamptz
) is 'Records first real Studio Pilot customer payment observation without refunding the customer; approves payment_path_verified only after successful payout evidence.';
