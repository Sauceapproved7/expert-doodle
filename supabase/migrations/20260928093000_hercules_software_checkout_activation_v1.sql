-- SauceApproved Studio + Ads commercial activation v1
-- Checkout remains fail-closed until product-specific owner approvals and Hercules-owned payment evidence are complete.

create table if not exists public.hercules_software_commercial_approvals (
  product_code text not null references public.hercules_software_products(code) on delete cascade,
  approval_type text not null check (approval_type in (
    'pricing','terms','privacy','payment_provider_ready','payment_path_verified'
  )),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  document_ref text,
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (product_code,approval_type)
);

alter table public.hercules_software_commercial_approvals enable row level security;
revoke all on public.hercules_software_commercial_approvals from anon, authenticated;

insert into public.hercules_software_commercial_approvals(product_code,approval_type,status,document_ref,evidence)
select p.code,a.approval_type,'pending',
  case a.approval_type
    when 'terms' then 'docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md'
    when 'privacy' then 'docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md'
    else null
  end,
  case a.approval_type
    when 'pricing' then jsonb_build_object(
      'currency','USD','interval','month',
      'starter_cents',2900,'pro_cents',7900,'agency_cents',19900,
      'owner_approval_required',true
    )
    when 'payment_provider_ready' then jsonb_build_object(
      'required_custody','hercules-owned',
      'external_appdeploy_attestation_not_sufficient',true
    )
    when 'payment_path_verified' then jsonb_build_object(
      'required_checks',jsonb_build_array(
        'checkout','subscription_state','webhook','cancellation','refund_or_reversal','entitlement_sync'
      )
    )
    else '{}'::jsonb
  end
from public.hercules_software_products p
cross join (
  values ('pricing'),('terms'),('privacy'),('payment_provider_ready'),('payment_path_verified')
) as a(approval_type)
where p.code in ('sauceapproved-studio','sauceapproved-ads')
on conflict (product_code,approval_type) do nothing;

create or replace function public.hercules_software_checkout_readiness(p_product_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_product public.hercules_software_products%rowtype;
  v_blockers jsonb;
  v_plans jsonb;
begin
  select * into v_product
  from public.hercules_software_products
  where code=p_product_code;

  if not found then
    return jsonb_build_object('ok',false,'error','product_not_found');
  end if;

  select coalesce(jsonb_agg(approval_type order by approval_type),'[]'::jsonb)
  into v_blockers
  from public.hercules_software_commercial_approvals
  where product_code=p_product_code and status<>'approved';

  select coalesce(jsonb_agg(jsonb_build_object(
    'plan_code',plan_code,
    'label',label,
    'monthly_price_cents',candidate_monthly_price_cents,
    'pricing_status',pricing_status,
    'checkout_enabled',checkout_enabled
  ) order by candidate_monthly_price_cents),'[]'::jsonb)
  into v_plans
  from public.hercules_software_product_plans
  where product_code=p_product_code;

  return jsonb_build_object(
    'ok',true,
    'product_code',p_product_code,
    'checkout_enabled',v_product.checkout_enabled,
    'ready',jsonb_array_length(v_blockers)=0,
    'blockers',v_blockers,
    'plans',v_plans
  );
end;
$function$;

create or replace function public.hercules_software_checkout_dry_run(
  p_product_code text,
  p_plan_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_plan public.hercules_software_product_plans%rowtype;
  v_ready jsonb;
begin
  select * into v_plan
  from public.hercules_software_product_plans
  where product_code=p_product_code and plan_code=p_plan_code;

  if not found then
    return jsonb_build_object('ok',false,'error','plan_not_found');
  end if;

  v_ready:=public.hercules_software_checkout_readiness(p_product_code);

  return jsonb_build_object(
    'ok',true,
    'mode','dry_run_no_charge',
    'product_code',p_product_code,
    'plan_code',p_plan_code,
    'would_charge_cents',v_plan.candidate_monthly_price_cents,
    'currency','USD',
    'interval','month',
    'checkout_allowed',coalesce((v_ready->>'ready')::boolean,false),
    'blockers',v_ready->'blockers'
  );
end;
$function$;

create or replace function public.hercules_software_owner_approve(
  p_product_code text,
  p_approval_type text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_required text;
  v_is_owner boolean:=false;
  v_row public.hercules_software_commercial_approvals%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if p_approval_type not in ('pricing','terms','privacy') then raise exception 'owner_approval_type_not_allowed'; end if;

  select exists(
    select 1 from public.hercules_memberships
    where organization_id='ea5fb196-67f9-42fa-b592-49eeb3b84346'
      and user_id=v_uid
      and status='active'
      and role='owner'
  ) into v_is_owner;

  if not v_is_owner then raise exception 'owner_access_required'; end if;

  v_required:=format('APPROVE %s %s V1',p_product_code,upper(p_approval_type));
  if p_confirmation is distinct from v_required then raise exception 'confirmation_phrase_mismatch'; end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=v_uid,
      approved_at=now(),
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'confirmation_phrase',v_required,
        'approved_via','hercules_software_owner_approve'
      ),
      updated_at=now()
  where product_code=p_product_code and approval_type=p_approval_type
  returning * into v_row;

  if not found then raise exception 'approval_record_not_found'; end if;

  return jsonb_build_object(
    'ok',true,'product_code',p_product_code,'approval_type',p_approval_type,
    'status',v_row.status,'approved_at',v_row.approved_at
  );
end;
$function$;

create or replace function public.hercules_software_record_payment_gate(
  p_product_code text,
  p_gate text,
  p_verified boolean,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_gate not in ('payment_provider_ready','payment_path_verified') then raise exception 'invalid_payment_gate'; end if;

  update public.hercules_software_commercial_approvals
  set status=case when p_verified then 'approved' else 'pending' end,
      approved_by=null,
      approved_at=case when p_verified then now() else null end,
      evidence=coalesce(p_evidence,'{}'::jsonb)||jsonb_build_object(
        'verified_by','hercules-owned-payment-control',
        'verified',p_verified
      ),
      updated_at=now()
  where product_code=p_product_code and approval_type=p_gate;

  if not found then raise exception 'approval_record_not_found'; end if;
  return public.hercules_software_checkout_readiness(p_product_code);
end;
$function$;

create or replace function public.hercules_activate_software_checkout(p_product_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_ready jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;

  v_ready:=public.hercules_software_checkout_readiness(p_product_code);
  if coalesce((v_ready->>'ready')::boolean,false) is not true then
    raise exception 'checkout_activation_blocked';
  end if;

  update public.hercules_software_products
  set checkout_enabled=true,status='active',updated_at=now()
  where code=p_product_code;

  update public.hercules_software_product_plans
  set pricing_status='approved',checkout_enabled=true,updated_at=now()
  where product_code=p_product_code
    and candidate_monthly_price_cents in (2900,7900,19900);

  return public.hercules_software_checkout_readiness(p_product_code);
end;
$function$;

revoke all on function public.hercules_software_checkout_readiness(text) from public, anon;
revoke all on function public.hercules_software_checkout_dry_run(text,text) from public, anon;
revoke all on function public.hercules_software_owner_approve(text,text,text) from public, anon;
revoke all on function public.hercules_software_record_payment_gate(text,text,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.hercules_activate_software_checkout(text) from public, anon, authenticated;

grant execute on function public.hercules_software_checkout_readiness(text) to authenticated;
grant execute on function public.hercules_software_checkout_dry_run(text,text) to authenticated;
grant execute on function public.hercules_software_owner_approve(text,text,text) to authenticated;
grant execute on function public.hercules_software_record_payment_gate(text,text,boolean,jsonb) to service_role;
grant execute on function public.hercules_activate_software_checkout(text) to service_role;
