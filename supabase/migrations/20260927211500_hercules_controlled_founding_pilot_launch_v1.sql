do $$
declare
  v_public_open boolean := false;
begin
  select coalesce((value->>'open')::boolean,false)
    into v_public_open
    from public.hercules_continuity_ledger
   where key='public-registration-open';

  if v_public_open is true then
    raise exception 'public registration must remain closed for controlled pilot launch';
  end if;
end;
$$;

insert into public.hercules_continuity_ledger(
  key,category,status,value,provenance,verified_at,updated_at
)
values(
  'controlled-founding-pilot-open',
  'launch',
  'active',
  jsonb_build_object(
    'open',true,
    'mode','controlled_founding_pilot',
    'market','US_B2B_OWN_RECEIVABLES',
    'publicAccountRegistrationOpen',false,
    'paidBillingActive',false,
    'pilotFeeActive',false
  ),
  'User-directed controlled Hercules Founding Pilot launch. Public registration and paid billing remain separately fail-closed.',
  now(),
  now()
)
on conflict(key) do update
set category=excluded.category,
    status=excluded.status,
    value=excluded.value,
    provenance=excluded.provenance,
    verified_at=excluded.verified_at,
    updated_at=excluded.updated_at;
