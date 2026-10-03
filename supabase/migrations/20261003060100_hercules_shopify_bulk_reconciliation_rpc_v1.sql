create table if not exists public.hercules_shopify_bulk_webhook_receipts (
  webhook_id text primary key,
  event_id text,
  shop_domain text not null check (shop_domain = 'sauceapproved-2.myshopify.com'),
  operation_gid text not null,
  received_at timestamptz not null default now()
);
alter table public.hercules_shopify_bulk_webhook_receipts enable row level security;
revoke all on public.hercules_shopify_bulk_webhook_receipts from public, anon, authenticated;
grant all on public.hercules_shopify_bulk_webhook_receipts to service_role;

create or replace function public.hercules_shopify_upsert_bulk_order_state_v1(
 p_tenant_id uuid, p_shop_domain text, p_resource_gid text, p_updated_at timestamptz,
 p_payload_sha256 text, p_canonical_state jsonb, p_run_id uuid
) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_current public.hercules_shopify_bulk_resource_state%rowtype;
begin
 if current_user <> 'service_role' and coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_tenant_id is null or p_shop_domain <> 'sauceapproved-2.myshopify.com'
   or p_resource_gid !~ '^gid://shopify/Order/[0-9]+$' or p_updated_at is null
   or coalesce(p_payload_sha256,'') !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_canonical_state) <> 'object'
   or p_run_id is null then raise exception 'bulk_order_state_invalid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_resource_gid,0));
 select * into v_current from public.hercules_shopify_bulk_resource_state
  where tenant_id=p_tenant_id and resource_gid=p_resource_gid for update;
 if found then
  if p_updated_at < v_current.shopify_updated_at then return 'skipped'; end if;
  if p_updated_at = v_current.shopify_updated_at and p_payload_sha256 = v_current.payload_sha256 then return 'skipped'; end if;
  update public.hercules_shopify_bulk_resource_state set shop_domain=p_shop_domain,
    resource_type='orders',shopify_updated_at=p_updated_at,payload_sha256=p_payload_sha256,
    canonical_state=p_canonical_state,last_reconciled_at=now(),last_reconciliation_run_id=p_run_id
    where tenant_id=p_tenant_id and resource_gid=p_resource_gid;
  return 'updated';
 end if;
 insert into public.hercules_shopify_bulk_resource_state
  (tenant_id,shop_domain,resource_type,resource_gid,shopify_updated_at,payload_sha256,canonical_state,last_reconciliation_run_id)
 values (p_tenant_id,p_shop_domain,'orders',p_resource_gid,p_updated_at,p_payload_sha256,p_canonical_state,p_run_id);
 return 'inserted';
end $$;
revoke all on function public.hercules_shopify_upsert_bulk_order_state_v1(uuid,text,text,timestamptz,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hercules_shopify_upsert_bulk_order_state_v1(uuid,text,text,timestamptz,text,jsonb,uuid) to service_role;
