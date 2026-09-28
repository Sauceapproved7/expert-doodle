-- SauceApproved Studio + Ads isolated Stripe payment path v1.
-- This layer never reuses hercules_plans / hercules_subscriptions for software-product billing.

create table if not exists public.hercules_software_stripe_catalog (
  product_code text not null,
  plan_code text not null,
  stripe_account_id text not null,
  stripe_product_id text not null,
  stripe_price_id text not null unique,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  currency text not null default 'usd',
  livemode boolean not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (product_code,plan_code),
  foreign key (product_code,plan_code)
    references public.hercules_software_product_plans(product_code,plan_code)
    on delete cascade
);

create table if not exists public.hercules_software_subscriptions (
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  product_code text not null,
  plan_code text not null,
  status text not null default 'incomplete'
    check (status in ('trialing','active','past_due','canceled','paused','incomplete','incomplete_expired','unpaid')),
  billing_provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,product_code),
  foreign key (product_code,plan_code)
    references public.hercules_software_product_plans(product_code,plan_code)
);

create table if not exists public.hercules_software_entitlements (
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  product_code text not null references public.hercules_software_products(code) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  source text not null default 'subscription'
    check (source in ('subscription','override','promo','system')),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id,product_code,feature_key)
);

create table if not exists public.hercules_software_payment_verification_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  product_code text not null,
  plan_code text not null,
  stripe_account_id text not null,
  livemode boolean not null,
  expected_amount_cents integer not null check (expected_amount_cents > 0),
  status text not null default 'prepared'
    check (status in ('prepared','in_progress','verified','failed','expired')),
  checkout_session_id text unique,
  provider_customer_id text,
  provider_subscription_id text,
  invoice_id text,
  payment_intent_id text,
  refund_id text,
  started_by uuid references auth.users(id),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (product_code,plan_code)
    references public.hercules_software_product_plans(product_code,plan_code)
);

create table if not exists public.hercules_software_payment_verification_events (
  run_id uuid not null references public.hercules_software_payment_verification_runs(id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  payload_hash text,
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (run_id,stripe_event_id)
);

create index if not exists hercules_software_subscription_provider_idx
  on public.hercules_software_subscriptions(provider_subscription_id);
create index if not exists hercules_software_verification_status_idx
  on public.hercules_software_payment_verification_runs(status,created_at desc);
create index if not exists hercules_software_verification_event_type_idx
  on public.hercules_software_payment_verification_events(run_id,event_type);

alter table public.hercules_software_stripe_catalog enable row level security;
alter table public.hercules_software_subscriptions enable row level security;
alter table public.hercules_software_entitlements enable row level security;
alter table public.hercules_software_payment_verification_runs enable row level security;
alter table public.hercules_software_payment_verification_events enable row level security;

revoke all on public.hercules_software_stripe_catalog from anon, authenticated;
revoke all on public.hercules_software_subscriptions from anon, authenticated;
revoke all on public.hercules_software_entitlements from anon, authenticated;
revoke all on public.hercules_software_payment_verification_runs from anon, authenticated;
revoke all on public.hercules_software_payment_verification_events from anon, authenticated;

create or replace function public.hercules_software_record_verification_event(
  p_run_id uuid,
  p_stripe_event_id text,
  p_event_type text,
  p_payload_hash text default null,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_run public.hercules_software_payment_verification_runs%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if p_run_id is null or coalesce(trim(p_stripe_event_id),'')='' or coalesce(trim(p_event_type),'')='' then
    raise exception 'verification_event_identity_required';
  end if;

  select * into v_run
  from public.hercules_software_payment_verification_runs
  where id=p_run_id;
  if not found then raise exception 'verification_run_not_found'; end if;

  insert into public.hercules_software_payment_verification_events(
    run_id,stripe_event_id,event_type,payload_hash,evidence
  )
  values(p_run_id,p_stripe_event_id,p_event_type,p_payload_hash,coalesce(p_evidence,'{}'::jsonb))
  on conflict (stripe_event_id) do nothing;

  update public.hercules_software_payment_verification_runs
  set status=case when status='prepared' then 'in_progress' else status end,
      updated_at=now()
  where id=p_run_id;

  return jsonb_build_object('ok',true,'run_id',p_run_id,'event_type',p_event_type);
end;
$function$;

create or replace function public.hercules_software_certify_payment_path(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_run public.hercules_software_payment_verification_runs%rowtype;
  v_plan public.hercules_software_product_plans%rowtype;
  v_missing jsonb;
  v_required text[]:=array[
    'checkout.session.completed',
    'customer.subscription.created',
    'invoice.payment_succeeded',
    'customer.subscription.deleted',
    'charge.refunded'
  ];
  v_gate_count integer;
  v_catalog public.hercules_software_stripe_catalog%rowtype;
  v_result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;

  select * into v_run
  from public.hercules_software_payment_verification_runs
  where id=p_run_id
  for update;
  if not found then raise exception 'verification_run_not_found'; end if;
  if v_run.status='verified' then
    return jsonb_build_object('ok',true,'already_verified',true,'run_id',v_run.id,'product_code',v_run.product_code);
  end if;
  if v_run.livemode is not true then raise exception 'live_mode_verification_required'; end if;

  select * into v_plan
  from public.hercules_software_product_plans
  where product_code=v_run.product_code and plan_code=v_run.plan_code;
  if not found then raise exception 'software_plan_not_found'; end if;
  if v_run.expected_amount_cents<>v_plan.candidate_monthly_price_cents then
    raise exception 'verification_amount_mismatch';
  end if;

  select * into v_catalog
  from public.hercules_software_stripe_catalog
  where product_code=v_run.product_code
    and plan_code=v_run.plan_code
    and active=true
    and livemode=true
    and stripe_account_id=v_run.stripe_account_id
    and unit_amount_cents=v_run.expected_amount_cents;
  if not found then raise exception 'live_software_stripe_catalog_mismatch'; end if;

  select count(*) into v_gate_count
  from public.hercules_software_commercial_approvals
  where product_code=v_run.product_code
    and approval_type in ('pricing','terms','privacy','payment_provider_ready')
    and status='approved';
  if v_gate_count<>4 then raise exception 'commercial_prerequisites_not_approved'; end if;

  select coalesce(jsonb_agg(req.event_type),'[]'::jsonb) into v_missing
  from (
    select unnest(v_required) as event_type
    except
    select event_type
    from public.hercules_software_payment_verification_events
    where run_id=p_run_id
  ) req;

  if jsonb_array_length(v_missing)>0 then
    return jsonb_build_object(
      'ok',false,
      'certified',false,
      'run_id',p_run_id,
      'missing_events',v_missing
    );
  end if;

  if coalesce(v_run.checkout_session_id,'')='' or
     coalesce(v_run.provider_subscription_id,'')='' or
     coalesce(v_run.invoice_id,'')='' or
     coalesce(v_run.payment_intent_id,'')='' or
     coalesce(v_run.refund_id,'')='' then
    raise exception 'verification_identifiers_incomplete';
  end if;

  select public.hercules_software_record_payment_gate(
    v_run.product_code,
    'payment_path_verified',
    true,
    jsonb_build_object(
      'verification_run_id',v_run.id,
      'stripe_account_id',v_run.stripe_account_id,
      'livemode',v_run.livemode,
      'plan_code',v_run.plan_code,
      'amount_cents',v_run.expected_amount_cents,
      'checkout_session_id',v_run.checkout_session_id,
      'subscription_id',v_run.provider_subscription_id,
      'invoice_id',v_run.invoice_id,
      'payment_intent_id',v_run.payment_intent_id,
      'refund_id',v_run.refund_id,
      'required_events',to_jsonb(v_required),
      'certified_at',now()
    )
  ) into v_result;

  update public.hercules_software_payment_verification_runs
  set status='verified',
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'certified',true,
        'required_events',to_jsonb(v_required)
      ),
      completed_at=now(),
      updated_at=now()
  where id=p_run_id;

  perform public.hercules_activate_software_checkout(v_run.product_code);

  return jsonb_build_object(
    'ok',true,
    'certified',true,
    'run_id',p_run_id,
    'product_code',v_run.product_code,
    'checkout_activation',v_result
  );
end;
$function$;

revoke all on function public.hercules_software_record_verification_event(uuid,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.hercules_software_certify_payment_path(uuid) from public,anon,authenticated;
grant execute on function public.hercules_software_record_verification_event(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.hercules_software_certify_payment_path(uuid) to service_role;
