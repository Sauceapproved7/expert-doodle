-- Hercules Titan Founding Access commercial approval v1
-- Separate one-time Titan offer. Owner approvals remain distinct from payment verification and public launch.

insert into public.hercules_software_products(
  code,name,descriptor,status,live_url,checkout_enabled,metadata
)
values (
  'hercules-titan-founding-access',
  'Hercules Titan Founding Access',
  'One-time founding access to Hercules Titan',
  'early_access',
  null,
  false,
  jsonb_build_object(
    'owned_lane',true,
    'commercial_mode','founding_access_one_time',
    'billing_model','one_time',
    'candidate_price_cents',4900,
    'currency','USD',
    'shopify_product_id','gid://shopify/Product/10261114782016',
    'shopify_sku','HERCULES-TITAN-FOUNDING',
    'offer_packet_version','hercules-titan-founding-access-offer-v1',
    'offer_packet_digest','8e9330f7cf70103e8fd8691cdd14a22d70eb466849c1b5a5fc98bc45c378a00f',
    'commercial_packet_version','hercules-titan-commercial-v1',
    'commercial_packet_digest','33c0f4567b6c0c06410b9bd546efdac8e2cc097f4c75b86728d539901e8bd5c7'
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
  'hercules-titan-founding-access',
  a.approval_type,
  'pending',
  case a.approval_type
    when 'terms' then 'docs/legal/HERCULES-TITAN-TERMS-CANDIDATE-V1.md'
    when 'privacy' then 'docs/legal/HERCULES-TITAN-PRIVACY-CANDIDATE-V1.md'
    else null
  end,
  case a.approval_type
    when 'pricing' then jsonb_build_object(
      'currency','USD',
      'billing_model','one_time',
      'candidate_price_cents',4900,
      'commercial_packet_version','hercules-titan-commercial-v1',
      'commercial_packet_digest','33c0f4567b6c0c06410b9bd546efdac8e2cc097f4c75b86728d539901e8bd5c7',
      'owner_approval_required',true
    )
    when 'terms' then jsonb_build_object(
      'terms_sha','5d4daec3fa321db5c13366f05cc66814348182f6',
      'covers',jsonb_build_array('entitlement','delivery','refund_and_cancellation','general_terms'),
      'owner_approval_required',true
    )
    when 'privacy' then jsonb_build_object(
      'privacy_sha','0ba9e0587ae38b3667a6397a70939f8f2c03b727',
      'owner_approval_required',true
    )
    when 'payment_provider_ready' then jsonb_build_object(
      'required_custody','hercules-owned',
      'owner_approval_required',false
    )
    when 'payment_path_verified' then jsonb_build_object(
      'required_checks',jsonb_build_array(
        'checkout','payment','webhook','entitlement_sync',
        'refund_or_reversal','payout_state'
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
  status='pending',
  approved_by=null,
  approved_at=null,
  document_ref=excluded.document_ref,
  evidence=excluded.evidence,
  updated_at=now();

create or replace function public.hercules_titan_owner_approve_bundle(
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
  v_expected_version constant text:='hercules-titan-commercial-v1';
  v_expected_digest constant text:='33c0f4567b6c0c06410b9bd546efdac8e2cc097f4c75b86728d539901e8bd5c7';
  v_expected_confirmation constant text:='APPROVE HERCULES TITAN COMMERCIAL PACKET 33C0F4567B6C';
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
    raise exception 'titan_packet_version_mismatch';
  end if;
  if p_packet_digest is distinct from v_expected_digest then
    raise exception 'titan_packet_digest_mismatch';
  end if;
  if p_confirmation is distinct from v_expected_confirmation then
    raise exception 'confirmation_phrase_mismatch';
  end if;

  select * into v_product
  from public.hercules_software_products
  where code='hercules-titan-founding-access';

  if not found then raise exception 'titan_product_missing'; end if;
  if v_product.checkout_enabled is true then raise exception 'titan_checkout_must_remain_closed_during_owner_approval'; end if;
  if coalesce(v_product.metadata->>'commercial_mode','')<>'founding_access_one_time'
     or coalesce((v_product.metadata->>'candidate_price_cents')::integer,0)<>4900 then
    raise exception 'titan_catalog_mismatch';
  end if;

  if exists(
    select 1
    from public.hercules_software_commercial_approvals
    where product_code='hercules-titan-founding-access'
      and approval_type='terms'
      and coalesce(document_ref,'')<>'docs/legal/HERCULES-TITAN-TERMS-CANDIDATE-V1.md'
  ) then raise exception 'titan_terms_document_mismatch'; end if;

  if exists(
    select 1
    from public.hercules_software_commercial_approvals
    where product_code='hercules-titan-founding-access'
      and approval_type='privacy'
      and coalesce(document_ref,'')<>'docs/legal/HERCULES-TITAN-PRIVACY-CANDIDATE-V1.md'
  ) then raise exception 'titan_privacy_document_mismatch'; end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=v_uid,
      approved_at=v_now,
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'commercial_packet_version',v_expected_version,
        'commercial_packet_digest',v_expected_digest,
        'confirmation_phrase',v_expected_confirmation,
        'approved_via','hercules_titan_owner_approve_bundle'
      ),
      updated_at=v_now
  where product_code='hercules-titan-founding-access'
    and approval_type in ('pricing','terms','privacy');

  get diagnostics v_count=row_count;
  if v_count<>3 then raise exception 'titan_owner_approval_rows_incomplete'; end if;

  return jsonb_build_object(
    'ok',true,
    'product_code','hercules-titan-founding-access',
    'packet_version',v_expected_version,
    'packet_digest',v_expected_digest,
    'owner_approvals',jsonb_build_array('pricing','terms','privacy'),
    'payment_gates_unchanged',true,
    'approved_at',v_now
  );
end;
$function$;

revoke all on function public.hercules_titan_owner_approve_bundle(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.hercules_titan_owner_approve_bundle(uuid,text,text,text) to service_role;

create or replace function public.hercules_guard_titan_checkout()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_offer_reconciled boolean:=false;
  v_payment_path boolean:=false;
begin
  if new.code='hercules-titan-founding-access'
     and new.checkout_enabled is true
     and coalesce(old.checkout_enabled,false) is false then

    select exists(
      select 1 from public.hercules_continuity_ledger
      where key='shopify-hercules-paid-offer-reconciled'
        and status='active'
    ) into v_offer_reconciled;

    select exists(
      select 1 from public.hercules_continuity_ledger
      where key='paid-billing-path-verified'
        and status='active'
    ) into v_payment_path;

    if not (v_offer_reconciled and v_payment_path) then
      raise exception 'titan_checkout_must_use_shopify_launch_gate';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists hercules_guard_titan_checkout_trigger on public.hercules_software_products;
create trigger hercules_guard_titan_checkout_trigger
before update of checkout_enabled on public.hercules_software_products
for each row execute function public.hercules_guard_titan_checkout();

update public.hercules_software_products
set checkout_enabled=false,updated_at=now()
where code='hercules-titan-founding-access';
