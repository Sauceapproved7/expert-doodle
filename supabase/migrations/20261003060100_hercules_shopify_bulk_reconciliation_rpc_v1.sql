create table if not exists public.hercules_shopify_bulk_webhook_receipts (
  webhook_id text primary key,
  event_id text,
  shop_domain text not null check (shop_domain = 'sauceapproved-2.myshopify.com'),
  operation_gid text not null check (operation_gid ~ '^gid://shopify/BulkOperation/[0-9]+$'),
  received_at timestamptz not null default now()
);

alter table public.hercules_shopify_bulk_webhook_receipts enable row level security;
revoke all on public.hercules_shopify_bulk_webhook_receipts from public, anon, authenticated;
grant all on public.hercules_shopify_bulk_webhook_receipts to service_role;

create or replace function public.hercules_shopify_upsert_bulk_order_state_v1(
  p_tenant_id uuid,
  p_shop_domain text,
  p_resource_gid text,
  p_updated_at timestamptz,
  p_payload_sha256 text,
  p_canonical_state jsonb,
  p_run_id uuid
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.hercules_shopify_bulk_resource_state%rowtype;
begin
  if current_user <> 'service_role' and coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_tenant_id is null
    or p_shop_domain is distinct from 'sauceapproved-2.myshopify.com'
    or p_resource_gid is null
    or p_resource_gid !~ '^gid://shopify/Order/[0-9]+$'
    or p_updated_at is null
    or coalesce(p_payload_sha256, '') !~ '^[a-f0-9]{64}$'
    or p_canonical_state is null
    or jsonb_typeof(p_canonical_state) <> 'object'
    or p_run_id is null then
    raise exception 'bulk_order_state_invalid';
  end if;

  if not exists (
    select 1 from public.hercules_shopify_bulk_reconciliation_runs
    where id = p_run_id
      and tenant_id = p_tenant_id
      and shop_domain = p_shop_domain
      and resource_type = 'orders'
      and status = 'processing'
  ) then
    raise exception 'bulk_run_tenant_or_state_mismatch';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_resource_gid, 0));

  select * into v_current
  from public.hercules_shopify_bulk_resource_state
  where tenant_id = p_tenant_id and resource_gid = p_resource_gid
  for update;

  if found then
    if p_updated_at < v_current.shopify_updated_at then return 'skipped'; end if;
    if p_updated_at = v_current.shopify_updated_at
      and p_payload_sha256 = v_current.payload_sha256 then
      return 'skipped';
    end if;

    update public.hercules_shopify_bulk_resource_state
      set shop_domain = p_shop_domain,
          resource_type = 'orders',
          shopify_updated_at = p_updated_at,
          payload_sha256 = p_payload_sha256,
          canonical_state = p_canonical_state,
          last_reconciled_at = now(),
          last_reconciliation_run_id = p_run_id
      where tenant_id = p_tenant_id and resource_gid = p_resource_gid;
    return 'updated';
  end if;

  insert into public.hercules_shopify_bulk_resource_state (
    tenant_id, shop_domain, resource_type, resource_gid, shopify_updated_at,
    payload_sha256, canonical_state, last_reconciliation_run_id
  ) values (
    p_tenant_id, p_shop_domain, 'orders', p_resource_gid, p_updated_at,
    p_payload_sha256, p_canonical_state, p_run_id
  );
  return 'inserted';
end;
$$;

revoke all on function public.hercules_shopify_upsert_bulk_order_state_v1(uuid,text,text,timestamptz,text,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.hercules_shopify_upsert_bulk_order_state_v1(uuid,text,text,timestamptz,text,jsonb,uuid)
  to service_role;

create or replace function public.hercules_shopify_complete_bulk_reconciliation_v1(
  p_run_id uuid,
  p_candidate_at timestamptz,
  p_records_seen bigint,
  p_records_inserted bigint,
  p_records_updated bigint,
  p_records_skipped bigint,
  p_result_sha256 text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.hercules_shopify_bulk_reconciliation_runs%rowtype;
begin
  if current_user <> 'service_role' and coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_run_id is null
    or p_candidate_at is null
    or p_records_seen is null
    or p_records_inserted is null
    or p_records_updated is null
    or p_records_skipped is null
    or least(p_records_seen, p_records_inserted, p_records_updated, p_records_skipped) < 0
    or p_records_inserted + p_records_updated + p_records_skipped <> p_records_seen
    or coalesce(p_result_sha256, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'reconciliation_completion_invalid';
  end if;

  select * into v_run
  from public.hercules_shopify_bulk_reconciliation_runs
  where id = p_run_id
  for update;

  if not found then raise exception 'reconciliation_run_not_found'; end if;
  if v_run.status = 'completed' then return; end if;
  if v_run.status <> 'processing' or v_run.records_failed <> 0 then
    raise exception 'reconciliation_run_not_fully_processed';
  end if;
  if p_candidate_at <> v_run.cursor_candidate_at then
    raise exception 'reconciliation_candidate_mismatch';
  end if;

  update public.hercules_shopify_bulk_reconciliation_runs
    set status = 'completed',
        completed_at = now(),
        records_seen = p_records_seen,
        records_inserted = p_records_inserted,
        records_updated = p_records_updated,
        records_skipped = p_records_skipped,
        result_sha256 = p_result_sha256
    where id = p_run_id;

  insert into public.hercules_shopify_bulk_reconciliation_watermarks (
    tenant_id, resource_type, last_successful_updated_at, last_successful_run_id, updated_at
  ) values (
    v_run.tenant_id, v_run.resource_type, p_candidate_at, p_run_id, now()
  )
  on conflict (tenant_id, resource_type) do update
    set last_successful_updated_at = greatest(
          coalesce(public.hercules_shopify_bulk_reconciliation_watermarks.last_successful_updated_at, 'epoch'::timestamptz),
          excluded.last_successful_updated_at
        ),
        last_successful_run_id = case
          when excluded.last_successful_updated_at >= coalesce(
            public.hercules_shopify_bulk_reconciliation_watermarks.last_successful_updated_at,
            'epoch'::timestamptz
          ) then excluded.last_successful_run_id
          else public.hercules_shopify_bulk_reconciliation_watermarks.last_successful_run_id
        end,
        updated_at = now();
end;
$$;

revoke all on function public.hercules_shopify_complete_bulk_reconciliation_v1(uuid,timestamptz,bigint,bigint,bigint,bigint,text)
  from public, anon, authenticated;
grant execute on function public.hercules_shopify_complete_bulk_reconciliation_v1(uuid,timestamptz,bigint,bigint,bigint,bigint,text)
  to service_role;
