-- Refresh the atomic Studio + Ads commercial approval packet after canonical legal-document updates.
-- This migration does not approve the packet or touch payment gates.

create or replace function public.hercules_software_owner_approve_bundle(
  p_bundle_version text,
  p_bundle_digest text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_owner boolean:=false;
  v_expected_version constant text:='software-commercial-v2';
  v_expected_digest constant text:='cd8f2488748f0aed1e85726816ace5c86288de3f873de7719d136ed9e4275b72';
  v_expected_confirmation constant text:='APPROVE SAUCEAPPROVED SOFTWARE COMMERCIAL PACKET CD8F2488748F';
  v_count integer;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select exists(
    select 1
    from public.hercules_memberships
    where organization_id='ea5fb196-67f9-42fa-b592-49eeb3b84346'
      and user_id=v_uid
      and status='active'
      and role='owner'
  ) into v_owner;

  if not v_owner then raise exception 'owner_access_required'; end if;
  if p_bundle_version is distinct from v_expected_version then raise exception 'software_commercial_bundle_version_mismatch'; end if;
  if lower(trim(coalesce(p_bundle_digest,''))) is distinct from v_expected_digest then raise exception 'software_commercial_bundle_digest_mismatch'; end if;
  if trim(coalesce(p_confirmation,'')) is distinct from v_expected_confirmation then raise exception 'explicit_confirmation_required'; end if;

  if exists(
    select 1 from public.hercules_software_products
    where code in ('sauceapproved-studio','sauceapproved-ads')
      and checkout_enabled=true
  ) then raise exception 'checkout_must_remain_locked_during_owner_bundle_approval'; end if;

  if exists(
    select 1
    from public.hercules_software_product_plans
    where product_code in ('sauceapproved-studio','sauceapproved-ads')
      and (
        (plan_code='starter' and candidate_monthly_price_cents<>2900) or
        (plan_code='pro' and candidate_monthly_price_cents<>7900) or
        (plan_code='agency' and candidate_monthly_price_cents<>19900) or
        plan_code not in ('starter','pro','agency')
      )
  ) then raise exception 'software_commercial_catalog_mismatch'; end if;

  if exists(
    select 1 from public.hercules_software_commercial_approvals
    where product_code in ('sauceapproved-studio','sauceapproved-ads')
      and approval_type='terms'
      and coalesce(document_ref,'')<>'docs/legal/SAUCEAPPROVED-SOFTWARE-TERMS-CANDIDATE-V1.md'
  ) then raise exception 'software_terms_document_mismatch'; end if;

  if exists(
    select 1 from public.hercules_software_commercial_approvals
    where product_code in ('sauceapproved-studio','sauceapproved-ads')
      and approval_type='privacy'
      and coalesce(document_ref,'')<>'docs/legal/SAUCEAPPROVED-SOFTWARE-PRIVACY-CANDIDATE-V1.md'
  ) then raise exception 'software_privacy_document_mismatch'; end if;

  update public.hercules_software_commercial_approvals
  set status='approved',
      approved_by=v_uid,
      approved_at=now(),
      evidence=coalesce(evidence,'{}'::jsonb)||jsonb_build_object(
        'bundle_version',v_expected_version,
        'bundle_digest',v_expected_digest,
        'confirmation_phrase',v_expected_confirmation,
        'approved_via','hercules_software_owner_approve_bundle',
        'terms_sha','2bf27cfb7f94d5599de509aa8c529a94751023d3',
        'privacy_sha','04f6217770cbc53829da36c25ecf3fa6584704fb'
      ),
      updated_at=now()
  where approval_type in ('pricing','terms','privacy')
    and product_code in ('sauceapproved-studio','sauceapproved-ads');

  get diagnostics v_count=row_count;
  if v_count<>6 then raise exception 'software_commercial_bundle_record_count_mismatch'; end if;

  return jsonb_build_object(
    'ok',true,
    'bundle_version',v_expected_version,
    'bundle_digest',v_expected_digest,
    'approved_records',v_count,
    'payment_gates_unchanged',true,
    'checkout_enabled',false
  );
end;
$function$;

revoke all on function public.hercules_software_owner_approve_bundle(text,text,text) from public, anon;
grant execute on function public.hercules_software_owner_approve_bundle(text,text,text) to authenticated;
