-- Hercules SoundWorld launch-gift durable ledger v1
-- Additive and fail-closed. Does not open paid checkout or start the 14-day window.

begin;

insert into public.hercules_continuity_ledger(
  key,category,status,value,provenance,verified_at,updated_at
)
values(
  'hercules-soundworld-launch-gift-window',
  'commercial_launch',
  'pending',
  jsonb_build_object(
    'openedAt',null,
    'durationDays',14,
    'customerPriceCents',0,
    'choices',jsonb_build_array(
      'soundworld-pods',
      'soundworld-max',
      'soundworld-portable-speaker'
    )
  ),
  'governance/hercules-soundworld-launch-gift-v1.json',
  now(),
  now()
)
on conflict (key) do nothing;

create table if not exists public.hercules_soundworld_gift_eligibility (
  id uuid primary key default gen_random_uuid(),
  purchase_key text not null,
  provider text not null check (provider in ('stripe','shopify')),
  provider_object_id text not null,
  product_code text not null references public.hercules_software_products(code) on delete restrict,
  organization_id uuid references public.hercules_organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  buyer_email_sha256 text check (
    buyer_email_sha256 is null or buyer_email_sha256 ~ '^[a-f0-9]{64}$'
  ),
  purchased_at timestamptz not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null,
  payment_settled boolean not null default true,
  verification_purchase boolean not null default false,
  promotion_opened_at timestamptz not null,
  promotion_closes_at timestamptz not null,
  status text not null default 'eligible' check (status in ('eligible','claimed','revoked')),
  source_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_key),
  check (promotion_closes_at = promotion_opened_at + interval '14 days')
);

create index if not exists hercules_soundworld_gift_eligibility_user_idx
  on public.hercules_soundworld_gift_eligibility(user_id,status,created_at desc)
  where user_id is not null;
create index if not exists hercules_soundworld_gift_eligibility_email_idx
  on public.hercules_soundworld_gift_eligibility(buyer_email_sha256,status,created_at desc)
  where buyer_email_sha256 is not null;
create index if not exists hercules_soundworld_gift_eligibility_org_idx
  on public.hercules_soundworld_gift_eligibility(organization_id,status,created_at desc)
  where organization_id is not null;

alter table public.hercules_soundworld_gift_eligibility enable row level security;
revoke all on public.hercules_soundworld_gift_eligibility from anon, authenticated;

create table if not exists public.hercules_soundworld_gift_reservations (
  id uuid primary key default gen_random_uuid(),
  purchase_key text not null,
  eligibility_id uuid not null references public.hercules_soundworld_gift_eligibility(id) on delete restrict,
  organization_id uuid references public.hercules_organizations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  gift_code text not null check (gift_code in (
    'soundworld-pods',
    'soundworld-max',
    'soundworld-portable-speaker'
  )),
  customer_price_cents integer not null default 0 check (customer_price_cents=0),
  status text not null default 'reserved' check (status in ('reserved','fulfilled','canceled')),
  fulfillment_mode text not null default 'deferred_until_production_available'
    check (fulfillment_mode='deferred_until_production_available'),
  metadata jsonb not null default '{}'::jsonb,
  reserved_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (purchase_key)
);

create index if not exists hercules_soundworld_gift_reservations_user_idx
  on public.hercules_soundworld_gift_reservations(user_id,reserved_at desc);

alter table public.hercules_soundworld_gift_reservations enable row level security;
revoke all on public.hercules_soundworld_gift_reservations from anon, authenticated;

create or replace function public.hercules_soundworld_record_purchase_eligibility(
  p_purchase_key text,
  p_provider text,
  p_provider_object_id text,
  p_product_code text,
  p_organization_id uuid,
  p_user_id uuid,
  p_buyer_email_sha256 text,
  p_purchased_at timestamptz,
  p_amount_cents bigint,
  p_currency text,
  p_payment_settled boolean,
  p_verification_purchase boolean,
  p_source_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_window record;
  v_opened_at timestamptz;
  v_closes_at timestamptz;
  v_row public.hercules_soundworld_gift_eligibility%rowtype;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_verification_purchase is true then
    return jsonb_build_object('ok',false,'eligible',false,'reason','verification_purchase_excluded');
  end if;
  if p_payment_settled is not true then
    return jsonb_build_object('ok',false,'eligible',false,'reason','payment_not_settled');
  end if;
  if nullif(trim(coalesce(p_purchase_key,'')),'') is null then
    raise exception 'purchase_key_required';
  end if;
  if p_provider not in ('stripe','shopify') then
    raise exception 'invalid_purchase_provider';
  end if;
  if p_buyer_email_sha256 is not null and p_buyer_email_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'buyer_email_sha256_invalid';
  end if;
  if not exists(select 1 from public.hercules_software_products where code=p_product_code) then
    return jsonb_build_object('ok',false,'eligible',false,'reason','product_not_eligible');
  end if;

  select status,value
  into v_window
  from public.hercules_continuity_ledger
  where key='hercules-soundworld-launch-gift-window'
  limit 1;

  if v_window.status is distinct from 'active'
     or nullif(v_window.value->>'openedAt','') is null then
    return jsonb_build_object('ok',false,'eligible',false,'reason','public_paid_launch_not_open');
  end if;

  v_opened_at := (v_window.value->>'openedAt')::timestamptz;
  v_closes_at := v_opened_at + interval '14 days';

  if p_purchased_at < v_opened_at then
    return jsonb_build_object('ok',false,'eligible',false,'reason','purchase_before_promotion');
  end if;
  if p_purchased_at >= v_closes_at then
    return jsonb_build_object('ok',false,'eligible',false,'reason','promotion_window_closed');
  end if;

  insert into public.hercules_soundworld_gift_eligibility(
    purchase_key,provider,provider_object_id,product_code,
    organization_id,user_id,buyer_email_sha256,purchased_at,
    amount_cents,currency,payment_settled,verification_purchase,
    promotion_opened_at,promotion_closes_at,status,source_event_id,metadata
  )
  values(
    trim(p_purchase_key),p_provider,trim(p_provider_object_id),p_product_code,
    p_organization_id,p_user_id,p_buyer_email_sha256,p_purchased_at,
    greatest(coalesce(p_amount_cents,0),0),upper(coalesce(p_currency,'USD')),
    true,false,v_opened_at,v_closes_at,'eligible',p_source_event_id,
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (purchase_key) do nothing;

  select * into v_row
  from public.hercules_soundworld_gift_eligibility
  where purchase_key=trim(p_purchase_key);

  return jsonb_build_object(
    'ok',true,
    'eligible',v_row.status in ('eligible','claimed'),
    'purchase_key',v_row.purchase_key,
    'status',v_row.status,
    'promotion_opened_at',v_row.promotion_opened_at,
    'promotion_closes_at',v_row.promotion_closes_at
  );
end;
$function$;

create or replace function public.hercules_soundworld_claim_gift(
  p_purchase_key text,
  p_gift_code text,
  p_user_id uuid,
  p_buyer_email_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_elig public.hercules_soundworld_gift_eligibility%rowtype;
  v_res public.hercules_soundworld_gift_reservations%rowtype;
  v_identity_ok boolean:=false;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_user_id is null then raise exception 'authenticated_user_required'; end if;
  if p_gift_code not in (
    'soundworld-pods','soundworld-max','soundworld-portable-speaker'
  ) then raise exception 'invalid_soundworld_gift_choice'; end if;

  select * into v_elig
  from public.hercules_soundworld_gift_eligibility
  where purchase_key=trim(coalesce(p_purchase_key,''))
  for update;

  if not found or v_elig.status='revoked' then
    raise exception 'purchase_not_eligible';
  end if;

  v_identity_ok :=
    v_elig.user_id=p_user_id
    or (
      v_elig.buyer_email_sha256 is not null
      and p_buyer_email_sha256 is not null
      and v_elig.buyer_email_sha256=p_buyer_email_sha256
    );

  if not v_identity_ok then raise exception 'purchase_identity_mismatch'; end if;

  if exists(
    select 1 from public.hercules_soundworld_gift_reservations
    where purchase_key=v_elig.purchase_key
  ) then
    raise exception 'gift_already_reserved_for_purchase';
  end if;

  insert into public.hercules_soundworld_gift_reservations(
    purchase_key,eligibility_id,organization_id,user_id,gift_code,
    customer_price_cents,status,fulfillment_mode,metadata
  )
  values(
    v_elig.purchase_key,v_elig.id,v_elig.organization_id,p_user_id,p_gift_code,
    0,'reserved','deferred_until_production_available',
    jsonb_build_object(
      'promotion','hercules-soundworld-launch-gift-v1',
      'deferred_fulfillment_disclosure_required',true
    )
  )
  returning * into v_res;

  update public.hercules_soundworld_gift_eligibility
  set status='claimed',
      user_id=coalesce(user_id,p_user_id),
      claimed_at=now(),
      updated_at=now()
  where id=v_elig.id;

  return jsonb_build_object(
    'ok',true,
    'reservation_id',v_res.id,
    'purchase_key',v_res.purchase_key,
    'gift_code',v_res.gift_code,
    'customer_price_cents',v_res.customer_price_cents,
    'status',v_res.status,
    'fulfillment_mode',v_res.fulfillment_mode,
    'reserved_at',v_res.reserved_at
  );
end;
$function$;

create or replace function public.hercules_soundworld_open_launch_window(
  p_opened_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_launch_ready boolean:=false;
  v_existing record;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select coalesce(launch_ready,false) and checked_at >= now() - interval '15 minutes'
  into v_launch_ready
  from public.hercules_launch_gate_checks
  order by checked_at desc
  limit 1;

  if coalesce(v_launch_ready,false) is not true then
    raise exception 'paid_launch_gate_not_ready_or_stale';
  end if;

  select status,value into v_existing
  from public.hercules_continuity_ledger
  where key='hercules-soundworld-launch-gift-window'
  for update;

  if v_existing.status='active' and nullif(v_existing.value->>'openedAt','') is not null then
    return jsonb_build_object(
      'ok',true,
      'already_open',true,
      'openedAt',v_existing.value->>'openedAt',
      'closesAt',((v_existing.value->>'openedAt')::timestamptz + interval '14 days')
    );
  end if;

  update public.hercules_continuity_ledger
  set status='active',
      value=jsonb_build_object(
        'openedAt',p_opened_at,
        'durationDays',14,
        'customerPriceCents',0,
        'choices',jsonb_build_array(
          'soundworld-pods','soundworld-max','soundworld-portable-speaker'
        )
      ),
      provenance='hercules_soundworld_open_launch_window',
      verified_at=p_opened_at,
      updated_at=now()
  where key='hercules-soundworld-launch-gift-window';

  return jsonb_build_object(
    'ok',true,
    'already_open',false,
    'openedAt',p_opened_at,
    'closesAt',p_opened_at + interval '14 days'
  );
end;
$function$;

revoke all on function public.hercules_soundworld_record_purchase_eligibility(
  text,text,text,text,uuid,uuid,text,timestamptz,bigint,text,boolean,boolean,text,jsonb
) from public, anon, authenticated;
revoke all on function public.hercules_soundworld_claim_gift(text,text,uuid,text)
  from public, anon, authenticated;
revoke all on function public.hercules_soundworld_open_launch_window(timestamptz)
  from public, anon, authenticated;

grant execute on function public.hercules_soundworld_record_purchase_eligibility(
  text,text,text,text,uuid,uuid,text,timestamptz,bigint,text,boolean,boolean,text,jsonb
) to service_role;
grant execute on function public.hercules_soundworld_claim_gift(text,text,uuid,text)
  to service_role;
grant execute on function public.hercules_soundworld_open_launch_window(timestamptz)
  to service_role;

commit;
