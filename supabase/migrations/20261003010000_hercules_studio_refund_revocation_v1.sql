-- Studio refund/cancellation revocation v1. Studio only; Titan/commerce gates unchanged.
create or replace function public.hercules_revoke_studio_purchase(
  p_shop_domain text, p_order_id text, p_variant_id text, p_sku text,
  p_reason text default 'refund'
) returns jsonb
language plpgsql security definer
set search_path='public','pg_temp'
as $$
declare
  v_ent public.hercules_studio_purchase_entitlements%rowtype;
  v_now timestamptz := now();
  v_reason text := lower(trim(coalesce(p_reason,'refund')));
begin
  if current_user not in ('postgres','service_role')
     and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if lower(trim(coalesce(p_shop_domain,''))) <> 'sauceapproved-2.myshopify.com' then
    return jsonb_build_object('ok',false,'revoked',false,'reason','shop_domain_mismatch');
  end if;
  if nullif(trim(coalesce(p_order_id,'')),'') is null
     or nullif(trim(coalesce(p_variant_id,'')),'') is null
     or nullif(trim(coalesce(p_sku,'')),'') is null then
    raise exception 'purchase_identity_required';
  end if;
  if v_reason not in ('refund','cancellation','chargeback','payment_reversal') then
    raise exception 'revocation_reason_invalid';
  end if;

  select * into v_ent
  from public.hercules_studio_purchase_entitlements
  where product_code = 'sauceapproved-studio'
    and shop_domain = 'sauceapproved-2.myshopify.com'
    and provider_order_id = trim(p_order_id)
    and variant_id = trim(p_variant_id)
    and sku = trim(p_sku)
  for update
  limit 1;

  if not found then
    return jsonb_build_object('ok',true,'revoked',false,'reason','studio_entitlement_not_found');
  end if;
  if v_ent.status = 'revoked' then
    return jsonb_build_object('ok',true,'revoked',true,'reused',true,
      'entitlement_id',v_ent.id,'organization_id',v_ent.organization_id);
  end if;

  update public.hercules_studio_purchase_entitlements
  set status = 'revoked',
      revoked_at = v_now,
      updated_at = v_now,
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'revoked_reason',v_reason,
        'revocation_version','studio-refund-revocation-v1',
        'revoked_fail_closed',true)
  where id = v_ent.id
    and product_code = 'sauceapproved-studio';

  if v_ent.organization_id is not null and v_ent.claimed_user_id is not null then
    update public.hercules_memberships
    set status = 'inactive', updated_at = v_now
    where organization_id = v_ent.organization_id
      and user_id = v_ent.claimed_user_id;
  end if;

  return jsonb_build_object('ok',true,'revoked',true,'reused',false,
    'entitlement_id',v_ent.id,'organization_id',v_ent.organization_id,'reason',v_reason);
end;
$$;

revoke all on function public.hercules_revoke_studio_purchase(text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.hercules_revoke_studio_purchase(text,text,text,text,text)
  to service_role;
