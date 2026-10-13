-- Hercules Gatehouse private order-intent reservation, no payments.
create table public.gatehouse_purchase_intents (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null,
 site_id uuid not null,
 reference_hash text not null unique check (reference_hash ~ '^[0-9a-f]{64}$'),
 status text not null default 'awaiting-provider-readback' check (status = 'awaiting-provider-readback'),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 foreign key (site_id, owner_user_id) references public.gatehouse_customer_sites(id, owner_user_id) on delete cascade,
 check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);
create index gatehouse_purchase_intents_owner_idx on public.gatehouse_purchase_intents(owner_user_id, expires_at);
alter table public.gatehouse_purchase_intents enable row level security;
revoke all on public.gatehouse_purchase_intents from anon, authenticated;