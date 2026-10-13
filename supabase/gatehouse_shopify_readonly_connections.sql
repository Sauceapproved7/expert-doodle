-- Existing first-party Hercules Shopify app: separate order-read capability.
-- Does not affect the existing provider_connections monitor/webhook registry.
-- Only service-role authenticated first-party backend can access these Vault refs.
create table public.gatehouse_shopify_readonly_connections (
 organization_id uuid primary key references public.hercules_organizations(id) on delete cascade,
 client_id text not null check (client_id = '1ed12710f0b797a7a3328c1cf4e8b1f9'),
 shop_gid text not null check (shop_gid = 'gid://shopify/Shop/100002726208'),
 shop_domain text not null check (shop_domain = 'azymhc-x0.myshopify.com'),
 secret_ref uuid not null,
 access_secret_ref uuid not null,
 access_expires_at timestamptz not null,
 status text not null default 'readback-only' check (status = 'readback-only'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.gatehouse_shopify_readonly_connections enable row level security;
revoke all on public.gatehouse_shopify_readonly_connections from anon, authenticated;
