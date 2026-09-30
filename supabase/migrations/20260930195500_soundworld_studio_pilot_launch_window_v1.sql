-- SoundWorld launch window v1.1
-- Allow the independently approved Studio Founding Pilot to open the same 14-day customer gift window.

create or replace function public.hercules_soundworld_open_launch_window(
  p_opened_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  legacy_launch_gate boolean:=false;
  studio_pilot_launch_gate boolean:=false;
  v_studio_readiness jsonb;
  v_gate text;
  v_existing record;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select coalesce(launch_ready,false)
         and checked_at >= now() - interval '15 minutes'
  into legacy_launch_gate
  from public.hercules_launch_gate_checks
  order by checked_at desc
  limit 1;

  begin
    select public.hercules_studio_pilot_checkout_readiness()
    into v_studio_readiness;

    studio_pilot_launch_gate :=
      coalesce((v_studio_readiness->>'ready')::boolean,false)
      and coalesce((v_studio_readiness->>'checkout_enabled')::boolean,false)
      and coalesce(
        v_studio_readiness->'approvals'->>'payment_launch_capability',
        ''
      )='approved';
  exception when others then
    studio_pilot_launch_gate := false;
    v_studio_readiness := jsonb_build_object(
      'ready',false,
      'checkout_enabled',false,
      'error','studio_pilot_readiness_unavailable'
    );
  end;

  if not coalesce(legacy_launch_gate,false)
     and not coalesce(studio_pilot_launch_gate,false) then
    raise exception 'paid_launch_gate_not_ready_or_stale';
  end if;

  v_gate := case
    when coalesce(studio_pilot_launch_gate,false) then 'studio_pilot'
    else 'legacy'
  end;

  select status,value into v_existing
  from public.hercules_continuity_ledger
  where key='hercules-soundworld-launch-gift-window'
  for update;

  if v_existing.status='active'
     and nullif(v_existing.value->>'openedAt','') is not null then
    return jsonb_build_object(
      'ok',true,
      'already_open',true,
      'openedByGate',coalesce(v_existing.value->>'openedByGate',v_gate),
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
          'soundworld-pods',
          'soundworld-max',
          'soundworld-portable-speaker'
        ),
        'openedByGate',v_gate,
        'legacyLaunchGate',coalesce(legacy_launch_gate,false),
        'studioPilotLaunchGate',coalesce(studio_pilot_launch_gate,false),
        'studioPilotProductCode','sauceapproved-studio-founding-pilot'
      ),
      provenance='hercules_soundworld_open_launch_window',
      verified_at=p_opened_at,
      updated_at=now()
  where key='hercules-soundworld-launch-gift-window';

  return jsonb_build_object(
    'ok',true,
    'already_open',false,
    'openedByGate',v_gate,
    'legacy_launch_gate',coalesce(legacy_launch_gate,false),
    'studio_pilot_launch_gate',coalesce(studio_pilot_launch_gate,false),
    'studio_pilot_product_code','sauceapproved-studio-founding-pilot',
    'openedAt',p_opened_at,
    'closesAt',p_opened_at + interval '14 days'
  );
end;
$function$;

revoke all on function public.hercules_soundworld_open_launch_window(timestamptz)
  from public,anon,authenticated;
grant execute on function public.hercules_soundworld_open_launch_window(timestamptz)
  to service_role;
