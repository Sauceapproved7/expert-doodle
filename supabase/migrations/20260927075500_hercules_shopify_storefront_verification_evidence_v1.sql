alter table public.hercules_shopify_launch_readiness
  add column if not exists storefront_status text not null default 'unverified'
    check (storefront_status in ('unverified','verified','failed')),
  add column if not exists storefront_verified_at timestamptz,
  add column if not exists storefront_verification jsonb not null default '{}'::jsonb;

create or replace function public.hercules_shopify_storefront_verification_record(
  p_run_id text,
  p_page_title text,
  p_product_visible boolean,
  p_variants_visible boolean,
  p_purchase_control_visible boolean,
  p_source text default 'hercules-browser-agent'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_now timestamptz := now();
  v_verified boolean;
  v_status text;
  v_evidence jsonb;
begin
  if p_run_id is null
     or p_run_id !~ '^browser-agent-[0-9a-f-]{36}$'
     or length(p_run_id) > 80 then
    raise exception 'storefront_verification_run_id_invalid';
  end if;

  if p_page_title is null
     or length(trim(p_page_title)) < 3
     or length(p_page_title) > 500 then
    raise exception 'storefront_verification_page_title_invalid';
  end if;

  if p_source is null
     or trim(p_source) = ''
     or length(p_source) > 120 then
    raise exception 'storefront_verification_source_invalid';
  end if;

  v_verified :=
    coalesce(p_product_visible,false)
    and coalesce(p_variants_visible,false)
    and coalesce(p_purchase_control_visible,false);

  v_status := case when v_verified then 'verified' else 'failed' end;

  v_evidence := jsonb_build_object(
    'runId',p_run_id,
    'pageTitle',trim(p_page_title),
    'productVisible',coalesce(p_product_visible,false),
    'variantsVisible',coalesce(p_variants_visible,false),
    'purchaseControlVisible',coalesce(p_purchase_control_visible,false),
    'source',trim(p_source),
    'observedAt',v_now
  );

  update public.hercules_shopify_launch_readiness
  set storefront_status=v_status,
      storefront_verified_at=case when v_verified then v_now else storefront_verified_at end,
      storefront_verification=v_evidence,
      updated_at=v_now
  where singleton=true;

  if not found then
    raise exception 'shopify_launch_readiness_missing';
  end if;

  return jsonb_build_object(
    'ok',v_verified,
    'status',v_status,
    'verifiedAt',case when v_verified then v_now else null end,
    'evidence',v_evidence
  );
end;
$$;

revoke all on function public.hercules_shopify_storefront_verification_record(
  text,text,boolean,boolean,boolean,text
) from public, anon, authenticated;

grant execute on function public.hercules_shopify_storefront_verification_record(
  text,text,boolean,boolean,boolean,text
) to service_role;

comment on function public.hercules_shopify_storefront_verification_record(
  text,text,boolean,boolean,boolean,text
) is
  'Records sanitized live storefront evidence from an owned Hercules Browser Agent run. No browser credentials or session identifiers beyond the run id are stored.';
