-- Hercules Titan one-time live payment verification v1.
-- Isolated from recurring Studio/Ads subscriptions and from the Revenue Recovery payment-path evidence.

create table if not exists public.hercules_titan_stripe_catalog (
  product_code text primary key references public.hercules_software_products(code) on delete cascade,
  stripe_account_id text not null,
  stripe_product_id text not null,
  stripe_price_id text not null unique,
  unit_amount_cents integer not null check (unit_amount_cents = 4900),
  currency text not null default 'usd' check (currency='usd'),
  livemode boolean not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  check (product_code='hercules-titan-founding-access')
);

create table if not exists public.hercules_titan_payment_verification_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  product_code text not null default 'hercules-titan-founding-access'
    references public.hercules_software_products(code) on delete cascade,
  stripe_account_id text not null,
  livemode boolean not null,
  expected_amount_cents integer not null check (expected_amount_cents = 4900),
  status text not null default 'prepared'
    check (status in ('prepared','in_progress','verified','failed','expired')),
  checkout_session_id text unique,
  provider_customer_id text,
  payment_intent_id text,
  charge_id text,
  refund_id text,
  balance_transaction_id text,
  started_by uuid references auth.users(id),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (product_code='hercules-titan-founding-access')
);

create table if not exists public.hercules_titan_payment_verification_events (
  run_id uuid not null references public.hercules_titan_payment_verification_runs(id) on delete cascade,
  stripe_event_id text not null unique,
  event_type text not null,
  payload_hash text,
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (run_id,stripe_event_id)
);

create index if not exists hercules_titan_verification_status_idx
  on public.hercules_titan_payment_verification_runs(status,created_at desc);
create index if not exists hercules_titan_verification_event_type_idx
  on public.hercules_titan_payment_verification_events(run_id,event_type);

alter table public.hercules_titan_stripe_catalog enable row level security;
alter table public.hercules_titan_payment_verification_runs enable row level security;
alter table public.hercules_titan_payment_verification_events enable row level security;

revoke all on public.hercules_titan_stripe_catalog from anon, authenticated;
revoke all on public.hercules_titan_payment_verification_runs from anon, authenticated;
revoke all on public.hercules_titan_payment_verification_events from anon, authenticated;

create or replace function public.hercules_titan_record_verification_event(
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
  v_run public.hercules_titan_payment_verification_runs%rowtype;
begin
  if p_run_id is null or coalesce(trim(p_stripe_event_id),'')='' or coalesce(trim(p_event_type),'')='' then
    raise exception 'verification_event_identity_required';
  end if;

  select * into v_run
  from public.hercules_titan_payment_verification_runs
  where id=p_run_id;
  if not found then raise exception 'verification_run_not_found'; end if;

  insert into public.hercules_titan_payment_verification_events(
    run_id,stripe_event_id,event_type,payload_hash,evidence
  )
  values(
    p_run_id,p_stripe_event_id,p_event_type,p_payload_hash,coalesce(p_evidence,'{}'::jsonb)
  )
  on conflict (stripe_event_id) do nothing;

  update public.hercules_titan_payment_verification_runs
  set status=case when status='prepared' then 'in_progress' else status end,
      updated_at=now()
  where id=p_run_id;

  return jsonb_build_object('ok',true,'run_id',p_run_id,'event_type',p_event_type);
end;
$function$;

create or replace function public.hercules_titan_certify_payment_path(p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_run public.hercules_titan_payment_verification_runs%rowtype;
  v_catalog public.hercules_titan_stripe_catalog%rowtype;
  v_gate_count integer;
  v_missing jsonb;
  v_payout jsonb;
  v_required text[]:=array[
    'checkout.session.completed',
    'charge.refunded',
    'titan.payout_state_verified'
  ];
  v_gate jsonb;
begin
  select * into v_run
  from public.hercules_titan_payment_verification_runs
  where id=p_run_id
  for update;
  if not found then raise exception 'verification_run_not_found'; end if;

  if v_run.status='verified' then
    return jsonb_build_object(
      'ok',true,'already_verified',true,'run_id',v_run.id,'product_code',v_run.product_code
    );
  end if;

  if v_run.product_code<>'hercules-titan-founding-access' then
    raise exception 'titan_product_mismatch';
  end if;
  if v_run.livemode is not true then raise exception 'live_mode_verification_required'; end if;
  if v_run.expected_amount_cents<>4900 then raise exception 'verification_amount_mismatch'; end if;

  select * into v_catalog
  from public.hercules_titan_stripe_catalog
  where product_code='hercules-titan-founding-access'
    and active=true
    and livemode=true
    and stripe_account_id=v_run.stripe_account_id
    and unit_amount_cents=4900
    and currency='usd';
  if not found then raise exception 'live_titan_stripe_catalog_mismatch'; end if;

  select count(*) into v_gate_count
  from public.hercules_software_commercial_approvals
  where product_code='hercules-titan-founding-access'
    and approval_type in ('pricing','terms','privacy','payment_provider_ready')
    and status='approved';
  if v_gate_count<>4 then raise exception 'commercial_prerequisites_not_approved'; end if;

  select coalesce(jsonb_agg(req.event_type),'[]'::jsonb) into v_missing
  from (
    select unnest(v_required) as event_type
    except
    select event_type
    from public.hercules_titan_payment_verification_events
    where run_id=p_run_id
  ) req;

  if jsonb_array_length(v_missing)>0 then
    return jsonb_build_object(
      'ok',false,'certified',false,'run_id',p_run_id,'missing_events',v_missing
    );
  end if;

  select evidence into v_payout
  from public.hercules_titan_payment_verification_events
  where run_id=p_run_id and event_type='titan.payout_state_verified'
  order by observed_at desc
  limit 1;

  if coalesce((v_payout->>'charges_enabled')::boolean,false) is not true
     or coalesce((v_payout->>'payouts_enabled')::boolean,false) is not true
     or coalesce(v_payout->>'balance_transaction_id','')='' then
    raise exception 'payout_state_evidence_incomplete';
  end if;

  if coalesce(v_run.checkout_session_id,'')='' or
     coalesce(v_run.payment_intent_id,'')='' or
     coalesce(v_run.charge_id,'')='' or
     coalesce(v_run.refund_id,'')='' or
     coalesce(v_run.balance_transaction_id,'')='' then
    raise exception 'verification_identifiers_incomplete';
  end if;

  select public.hercules_software_record_payment_gate(
    'hercules-titan-founding-access',
    'payment_path_verified',
    true,
    jsonb_build_object(
      'verification_run_id',v_run.id,
      'stripe_account_id',v_run.stripe_account_id,
      'livemode',true,
      'billing_model','one_time',
      'amount_cents',4900,
      'checkout_session_id',v_run.checkout_session_id,
      'payment_intent_id',v_run.payment_intent_id,
      'charge_id',v_run.charge_id,
      'refund_id',v_run.refund_id,
      'balance_transaction_id',v_run.balance_transaction_id,
      'required_events',to_jsonb(v_required),
      'certified_at',now()
    )
  ) into v_gate;

  insert into public.hercules_continuity_ledger(
    key,category,status,value,provenance,verified_at,updated_at
  )
  values(
    'titan-paid-billing-path-verified',
    'commercial',
    'active',
    jsonb_build_object(
      'provider','stripe',
      'custody','supabase-vault',
      'productCode','hercules-titan-founding-access',
      'billingModel','one_time',
      'amountCents',4900,
      'accountKey',v_run.stripe_account_id,
      'verificationRunId',v_run.id,
      'checkoutVerified',true,
      'refundVerified',true,
      'payoutStateVerified',true,
      'checkoutSessionId',v_run.checkout_session_id,
      'paymentIntentId',v_run.payment_intent_id,
      'chargeId',v_run.charge_id,
      'refundId',v_run.refund_id,
      'balanceTransactionId',v_run.balance_transaction_id
    ),
    'hercules-titan-payment-path-v1',
    now(),
    now()
  )
  on conflict (key) do update set
    category=excluded.category,
    status=excluded.status,
    value=excluded.value,
    provenance=excluded.provenance,
    verified_at=excluded.verified_at,
    updated_at=excluded.updated_at;

  update public.hercules_titan_payment_verification_runs
  set status='verified',
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'certified',true,
        'required_events',to_jsonb(v_required),
        'payout_state',v_payout
      ),
      completed_at=now(),
      updated_at=now()
  where id=p_run_id;

  return jsonb_build_object(
    'ok',true,
    'certified',true,
    'run_id',p_run_id,
    'product_code','hercules-titan-founding-access',
    'payment_gate',v_gate,
    'checkout_activation',false
  );
end;
$function$;

revoke all on function public.hercules_titan_record_verification_event(uuid,text,text,text,jsonb)
  from public,anon,authenticated;
revoke all on function public.hercules_titan_certify_payment_path(uuid)
  from public,anon,authenticated;
grant execute on function public.hercules_titan_record_verification_event(uuid,text,text,text,jsonb)
  to service_role;
grant execute on function public.hercules_titan_certify_payment_path(uuid)
  to service_role;
