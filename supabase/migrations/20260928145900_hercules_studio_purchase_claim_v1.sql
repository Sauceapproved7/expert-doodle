-- Atomic verified-email claim for paid SauceApproved Studio purchases.
create or replace function public.hercules_claim_studio_purchase(
  p_user_id uuid,
  p_email_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_ent public.hercules_studio_purchase_entitlements%rowtype;
  v_existing public.hercules_studio_purchase_entitlements%rowtype;
  v_org public.hercules_organizations%rowtype;
  v_slug text;
  v_now timestamptz := now();
begin
  if p_user_id is null then return jsonb_build_object('ok',false,'error','authenticated_user_required'); end if;
  if p_email_sha256 is null or p_email_sha256 !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok',false,'error','email_hash_invalid');
  end if;

  if exists (
    select 1 from public.hercules_organizations o
    where o.slug='sauceapproved'
      and (
        o.owner_user_id=p_user_id
        or exists (
          select 1 from public.hercules_memberships m
          where m.organization_id=o.id and m.user_id=p_user_id and m.status='active'
        )
      )
  ) then
    return jsonb_build_object('ok',false,'error','founder_organization_forbidden');
  end if;

  select * into v_ent
  from public.hercules_studio_purchase_entitlements
  where buyer_email_sha256=p_email_sha256 and status='paid_pending_claim'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    select * into v_existing
    from public.hercules_studio_purchase_entitlements
    where buyer_email_sha256=p_email_sha256
      and status='claimed'
      and claimed_user_id=p_user_id
    order by claimed_at desc nulls last
    limit 1;

    if found then
      return jsonb_build_object(
        'ok',true,'reused',true,'entitlement_id',v_existing.id,
        'organization_id',v_existing.organization_id,
        'product_code',v_existing.product_code,
        'entitlement_version','studio-shopify-founding-pilot-v1'
      );
    end if;
    return jsonb_build_object('ok',false,'error','email_entitlement_mismatch');
  end if;

  v_slug := 'studio-pilot-' || substr(v_ent.entitlement_key,1,20);

  select * into v_org from public.hercules_organizations where slug=v_slug limit 1;
  if not found then
    insert into public.hercules_organizations(name,slug,owner_user_id,status,metadata,created_at,updated_at)
    values(
      'SauceApproved Studio Founding Pilot',v_slug,p_user_id,'active',
      jsonb_build_object(
        'product_code','sauceapproved-studio','plan_code','founding-pilot',
        'entitlement_id',v_ent.id,'entitlement_version','studio-shopify-founding-pilot-v1',
        'commerce_provider','shopify','public_registration',false,
        'source_code_included',false,'production_renderer_certified',false
      ),
      v_now,v_now
    )
    returning * into v_org;
  elsif v_org.owner_user_id<>p_user_id then
    return jsonb_build_object('ok',false,'error','entitlement_organization_owner_mismatch');
  end if;

  insert into public.hercules_memberships(organization_id,user_id,role,status,created_at,updated_at)
  values(v_org.id,p_user_id,'owner','active',v_now,v_now)
  on conflict (organization_id,user_id) do update
    set role='owner',status='active',updated_at=excluded.updated_at;

  update public.hercules_studio_purchase_entitlements
  set status='claimed',claimed_user_id=p_user_id,organization_id=v_org.id,
      claimed_at=v_now,updated_at=v_now,
      metadata=metadata || jsonb_build_object(
        'claimed_via','verified_supabase_email_session',
        'entitlement_version','studio-shopify-founding-pilot-v1'
      )
  where id=v_ent.id and status='paid_pending_claim';

  if not found then raise exception 'studio_entitlement_claim_conflict'; end if;

  return jsonb_build_object(
    'ok',true,'reused',false,'entitlement_id',v_ent.id,
    'organization_id',v_org.id,'product_code',v_ent.product_code,
    'plan_code','founding-pilot',
    'entitlement_version','studio-shopify-founding-pilot-v1'
  );
end;
$function$;

revoke all on function public.hercules_claim_studio_purchase(uuid,text) from public, anon, authenticated;
grant execute on function public.hercules_claim_studio_purchase(uuid,text) to service_role;
