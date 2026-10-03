-- Hercules approved software catalog activation guard v1
-- Fail-closed: checkout cannot activate from legacy candidate prices alone.

create or replace function public.hercules_software_record_approved_catalog(
  p_product_code text,
  p_catalog_version text,
  p_catalog_digest text,
  p_catalog jsonb,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_is_owner boolean:=false;
  v_required text;
  v_plan_count int:=0;
  v_match_count int:=0;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select exists(
    select 1 from public.hercules_memberships
    where organization_id='ea5fb196-67f9-42fa-b592-49eeb3b84346'
      and user_id=v_uid
      and status='active'
      and role='owner'
  ) into v_is_owner;

  if not v_is_owner then raise exception 'owner_access_required'; end if;
  if coalesce(trim(p_catalog_version),'')='' then raise exception 'catalog_version_required'; end if;
  if coalesce(trim(p_catalog_digest),'')='' then raise exception 'catalog_digest_required'; end if;
  if jsonb_typeof(p_catalog) <> 'object' then raise exception 'catalog_object_required'; end if;

  v_required:=format(
    'APPROVE SOFTWARE CATALOG %s %s %s',
    upper(p_product_code),
    upper(p_catalog_version),
    upper(left(p_catalog_digest,12))
  );
  if upper(trim(coalesce(p_confirmation,''))) <> v_required then
    raise exception 'confirmation_phrase_mismatch';
  end if;

  select count(*) into v_plan_count
  from public.hercules_software_product_plans
  where product_code=p_product_code;

  if v_plan_count=0 then raise exception 'software_plan_catalog_missing'; end if;

  select count(*) into v_match_count
  from public.hercules_software_product_plans p
  where p.product_code=p_product_code
    and (p_catalog ? p.plan_code)
    and jsonb_typeof(p_catalog->p.plan_code)='object'
    and coalesce((p_catalog->p.plan_code->>'monthly_price_cents')::int,-1)
        = p.candidate_monthly_price_cents;

  if v_match_count <> v_plan_count
     or jsonb_object_length(p_catalog) <> v_plan_count then
    raise exception 'software_catalog_price_mismatch';
  end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=v_uid,
      approved_at=now(),
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'approved_catalog_version',p_catalog_version,
        'approved_catalog_digest',lower(p_catalog_digest),
        'approved_catalog',p_catalog,
        'confirmation_phrase',v_required,
        'approved_via','hercules_software_record_approved_catalog'
      ),
      updated_at=now()
  where product_code=p_product_code and approval_type='pricing';

  if not found then raise exception 'pricing_approval_record_not_found'; end if;

  return jsonb_build_object(
    'ok',true,
    'product_code',p_product_code,
    'approved_catalog_version',p_catalog_version,
    'approved_catalog_digest',lower(p_catalog_digest),
    'approved_catalog',p_catalog
  );
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
  v_pricing public.hercules_software_commercial_approvals%rowtype;
  v_catalog jsonb;
  v_plan_count int:=0;
  v_match_count int:=0;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;

  v_ready:=public.hercules_software_checkout_readiness(p_product_code);
  if coalesce((v_ready->>'ready')::boolean,false) is not true then
    raise exception 'checkout_activation_blocked';
  end if;

  select * into v_pricing
  from public.hercules_software_commercial_approvals
  where product_code=p_product_code
    and approval_type='pricing'
    and status='approved';

  if not found
     or coalesce(v_pricing.evidence->>'approved_catalog_version','')=''
     or coalesce(v_pricing.evidence->>'approved_catalog_digest','')=''
     or jsonb_typeof(v_pricing.evidence->'approved_catalog') <> 'object' then
    raise exception 'software_approved_catalog_required';
  end if;

  v_catalog:=v_pricing.evidence->'approved_catalog';

  select count(*) into v_plan_count
  from public.hercules_software_product_plans
  where product_code=p_product_code;

  select count(*) into v_match_count
  from public.hercules_software_product_plans p
  where p.product_code=p_product_code
    and (v_catalog ? p.plan_code)
    and jsonb_typeof(v_catalog->p.plan_code)='object'
    and coalesce((v_catalog->p.plan_code->>'monthly_price_cents')::int,-1)
        = p.candidate_monthly_price_cents;

  if v_plan_count=0
     or v_match_count<>v_plan_count
     or jsonb_object_length(v_catalog)<>v_plan_count then
    raise exception 'software_catalog_price_mismatch';
  end if;

  update public.hercules_software_products
  set checkout_enabled=true,status='active',updated_at=now()
  where code=p_product_code;

  update public.hercules_software_product_plans
  set pricing_status='approved',checkout_enabled=true,updated_at=now()
  where product_code=p_product_code;

  return public.hercules_software_checkout_readiness(p_product_code)
    || jsonb_build_object(
      'approved_catalog_version',v_pricing.evidence->>'approved_catalog_version',
      'approved_catalog_digest',v_pricing.evidence->>'approved_catalog_digest'
    );
end;
$function$;

revoke all on function public.hercules_software_record_approved_catalog(text,text,text,jsonb,text) from public, anon;
revoke all on function public.hercules_activate_software_checkout(text) from public, anon, authenticated;

grant execute on function public.hercules_software_record_approved_catalog(text,text,text,jsonb,text) to authenticated;
grant execute on function public.hercules_activate_software_checkout(text) to service_role;
