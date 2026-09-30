-- Studio Founding Pilot SoundWorld launch window v1
-- Opens the existing 14-day gift window from Studio Pilot readiness, independent of Titan/Stripe.

create or replace function public.hercules_soundworld_open_studio_pilot_launch_window(
  p_opened_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_checkout_enabled boolean:=false;
  v_gate_count integer:=0;
  v_gates_ready boolean:=false;
  v_existing_status text;
  v_existing_value jsonb;
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','')<>'service_role' then
    raise exception 'service_role_required';
  end if;

  select coalesce(checkout_enabled,false)
  into v_checkout_enabled
  from public.hercules_software_products
  where code='sauceapproved-studio-founding-pilot';

  if v_checkout_enabled is not true then
    raise exception 'studio_pilot_checkout_not_enabled';
  end if;

  select count(*),count(*)=5 and bool_and(status='approved')
  into v_gate_count,v_gates_ready
  from public.hercules_software_commercial_approvals
  where product_code='sauceapproved-studio-founding-pilot'
    and approval_type in (
      'pricing',
      'terms',
      'privacy',
      'payment_provider_ready',
      'payment_launch_capability'
    );

  if v_gate_count<>5 or coalesce(v_gates_ready,false) is not true then
    raise exception 'studio_pilot_launch_gates_required';
  end if;

  select status,value
  into v_existing_status,v_existing_value
  from public.hercules_continuity_ledger
  where key='hercules-soundworld-launch-gift-window'
  for update;

  if v_existing_status='active'
     and nullif(v_existing_value->>'openedAt','') is not null then
    return jsonb_build_object(
      'ok',true,
      'already_open',true,
      'source','sauceapproved-studio-founding-pilot',
      'openedAt',v_existing_value->>'openedAt',
      'closesAt',((v_existing_value->>'openedAt')::timestamptz + interval '14 days')
    );
  end if;

  insert into public.hercules_continuity_ledger(
    key,status,value,provenance,verified_at,updated_at
  )
  values(
    'hercules-soundworld-launch-gift-window',
    'active',
    jsonb_build_object(
      'openedAt',p_opened_at,
      'durationDays',14,
      'customerPriceCents',0,
      'choices',jsonb_build_array(
        'soundworld-pods',
        'soundworld-max',
        'soundworld-portable-speaker'
      ),
      'launchProduct','sauceapproved-studio-founding-pilot',
      'launchGate','studio-pilot-no-self-payment-v1'
    ),
    'hercules_soundworld_open_studio_pilot_launch_window',
    p_opened_at,
    now()
  )
  on conflict (key) do update set
    status='active',
    value=excluded.value,
    provenance=excluded.provenance,
    verified_at=excluded.verified_at,
    updated_at=excluded.updated_at;

  return jsonb_build_object(
    'ok',true,
    'already_open',false,
    'source','sauceapproved-studio-founding-pilot',
    'openedAt',p_opened_at,
    'closesAt',p_opened_at + interval '14 days'
  );
end;
$function$;

revoke all on function public.hercules_soundworld_open_studio_pilot_launch_window(timestamptz)
  from public,anon,authenticated;

grant execute on function public.hercules_soundworld_open_studio_pilot_launch_window(timestamptz)
  to service_role;
