-- SauceApproved Studio Shopify purchase entitlement ledger v1
create table public.hercules_studio_purchase_entitlements (
  id uuid primary key default gen_random_uuid(),
  entitlement_key text not null unique check (entitlement_key ~ '^[a-f0-9]{64}$'),
  provider text not null default 'shopify' check (provider='shopify'),
  shop_domain text not null,
  provider_order_id text not null,
  provider_line_item_id text,
  product_code text not null default 'sauceapproved-studio',
  product_id text not null,
  variant_id text not null,
  sku text not null,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 100),
  buyer_email_sha256 text not null check (buyer_email_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'paid_pending_claim' check (status in ('paid_pending_claim','claimed','revoked')),
  claimed_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references public.hercules_organizations(id) on delete set null,
  source_webhook_id text,
  currency text,
  paid_total text,
  claimed_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shop_domain,provider_order_id,variant_id,sku)
);

create index hercules_studio_entitlements_email_status_idx
  on public.hercules_studio_purchase_entitlements(buyer_email_sha256,status,created_at desc);
create index hercules_studio_entitlements_user_idx
  on public.hercules_studio_purchase_entitlements(claimed_user_id)
  where claimed_user_id is not null;
create index hercules_studio_entitlements_org_idx
  on public.hercules_studio_purchase_entitlements(organization_id)
  where organization_id is not null;

alter table public.hercules_studio_purchase_entitlements enable row level security;
revoke all on public.hercules_studio_purchase_entitlements from anon, authenticated;

create table public.hercules_studio_shopify_webhook_events (
  webhook_id text primary key,
  event_id text,
  topic text not null,
  shop_domain text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('received','ignored','entitled','rejected')),
  entitlement_count integer not null default 0 check (entitlement_count >= 0),
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hercules_studio_shopify_webhook_events enable row level security;
revoke all on public.hercules_studio_shopify_webhook_events from anon, authenticated;
