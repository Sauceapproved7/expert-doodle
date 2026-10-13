-- Private Gatehouse Shopify candidate reservation, no real-money or delivery authorization.
-- Deduplicates candidate observations while this ledger is retained; no customer-facing
-- role can read or write it and status can never assert provider verification.
alter table public.gatehouse_purchase_intents
 add constraint gatehouse_purchase_intents_tenant_binding_unique
 unique (id, site_id, owner_user_id);

create table public.gatehouse_order_candidate_ledger (
 id uuid primary key default gen_random_uuid(),
 intent_id uuid not null,
 site_id uuid not null,
 owner_user_id uuid not null,
 order_hash text not null check (order_hash ~ '^[0-9a-f]{64}$'),
 provider text not null default 'shopify' check (provider = 'shopify'),
 item_unit_cents integer not null default 4900 check (item_unit_cents = 4900),
 candidate_status text not null default 'requires-provider-verification'
   check (candidate_status = 'requires-provider-verification'),
 created_at timestamptz not null default now(),
 unique (intent_id),
 unique (order_hash),
 foreign key (intent_id, site_id, owner_user_id)
  references public.gatehouse_purchase_intents(id, site_id, owner_user_id)
  on delete cascade
);

create index gatehouse_order_candidate_owner_idx
 on public.gatehouse_order_candidate_ledger(owner_user_id, created_at);

alter table public.gatehouse_order_candidate_ledger enable row level security;
revoke all on public.gatehouse_order_candidate_ledger from anon, authenticated;
