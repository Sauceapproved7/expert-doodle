-- Separate, privacy-minimized order-state reconciliation. This never issues commerce effects.
create table if not exists public.hercules_shopify_bulk_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  shop_domain text not null check (shop_domain = 'sauceapproved-2.myshopify.com'),
  resource_type text not null check (resource_type = 'orders'),
  mode text not null check (mode in ('backfill','incremental','full')),
  status text not null check (status in ('requested','running','queued','downloading','processing','completed','failed')),
  bulk_operation_gid text unique,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cursor_started_at timestamptz,
  cursor_candidate_at timestamptz not null default now(),
  records_seen bigint not null default 0 check (records_seen >= 0),
  records_inserted bigint not null default 0 check (records_inserted >= 0),
  records_updated bigint not null default 0 check (records_updated >= 0),
  records_skipped bigint not null default 0 check (records_skipped >= 0),
  records_failed bigint not null default 0 check (records_failed >= 0),
  result_sha256 text check (result_sha256 is null or result_sha256 ~ '^[a-f0-9]{64}$'),
  error_code text,
  error_message text
);
create unique index if not exists hercules_shopify_bulk_one_active_run
  on public.hercules_shopify_bulk_reconciliation_runs (tenant_id, resource_type)
  where status in ('requested','running','queued','downloading','processing');
create index if not exists hercules_shopify_bulk_runs_queue
  on public.hercules_shopify_bulk_reconciliation_runs (status, started_at);

create table if not exists public.hercules_shopify_bulk_reconciliation_watermarks (
  tenant_id uuid not null,
  resource_type text not null check (resource_type = 'orders'),
  last_successful_updated_at timestamptz,
  last_successful_run_id uuid references public.hercules_shopify_bulk_reconciliation_runs(id),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, resource_type)
);

create table if not exists public.hercules_shopify_bulk_resource_state (
  tenant_id uuid not null,
  shop_domain text not null check (shop_domain = 'sauceapproved-2.myshopify.com'),
  resource_type text not null check (resource_type = 'orders'),
  resource_gid text not null check (resource_gid like 'gid://shopify/Order/%'),
  shopify_updated_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  canonical_state jsonb not null,
  last_reconciled_at timestamptz not null default now(),
  last_reconciliation_run_id uuid not null references public.hercules_shopify_bulk_reconciliation_runs(id),
  primary key (tenant_id, resource_gid)
);
create index if not exists hercules_shopify_bulk_state_updated
  on public.hercules_shopify_bulk_resource_state (tenant_id, shopify_updated_at);

alter table public.hercules_shopify_bulk_reconciliation_runs enable row level security;
alter table public.hercules_shopify_bulk_reconciliation_watermarks enable row level security;
alter table public.hercules_shopify_bulk_resource_state enable row level security;
revoke all on public.hercules_shopify_bulk_reconciliation_runs from public, anon, authenticated;
revoke all on public.hercules_shopify_bulk_reconciliation_watermarks from public, anon, authenticated;
revoke all on public.hercules_shopify_bulk_resource_state from public, anon, authenticated;
grant all on public.hercules_shopify_bulk_reconciliation_runs to service_role;
grant all on public.hercules_shopify_bulk_reconciliation_watermarks to service_role;
grant all on public.hercules_shopify_bulk_resource_state to service_role;
