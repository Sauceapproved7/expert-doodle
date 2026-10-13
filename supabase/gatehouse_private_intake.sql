-- Hercules Gatehouse isolated customer-intake storage v1.
-- Additive only; no merchant orders, payments or existing organization tables affected.
-- Owner-authenticated Edge Function is the only intended gateway.
create table public.gatehouse_customer_sites (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 origin text not null check (char_length(origin) between 12 and 256),
 consent_version text not null check (consent_version = 'gatehouse-diagnostic-v1'),
 authorized_at timestamptz not null,
 stage text not null default 'awaiting-domain-control'
  check (stage = 'awaiting-domain-control'),
 created_at timestamptz not null default now(),
 unique (owner_user_id, origin),
 unique (id, owner_user_id)
);
create table public.gatehouse_customer_reports (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null,
 owner_user_id uuid not null,
 summary jsonb not null default '{}'::jsonb
  check (octet_length(summary::text) <= 32768),
 delivery_state text not null default 'withheld'
  check (delivery_state = 'withheld'),
 created_at timestamptz not null default now(),
 foreign key (site_id, owner_user_id)
  references public.gatehouse_customer_sites (id, owner_user_id)
  on delete cascade
);
create index gatehouse_customer_sites_owner_idx on public.gatehouse_customer_sites(owner_user_id);
create index gatehouse_customer_reports_owner_idx on public.gatehouse_customer_reports(owner_user_id, site_id);
alter table public.gatehouse_customer_sites enable row level security;
alter table public.gatehouse_customer_reports enable row level security;
revoke all on public.gatehouse_customer_sites from anon, authenticated;
revoke all on public.gatehouse_customer_reports from anon, authenticated;
-- Neither site records nor reports are granted to unauthenticated or authenticated Data API callers.
-- Authenticated owner access is mediated by the server and always bound to auth.getUser(token).
-- This defense-in-depth SELECT policy grants nothing unless an explicit GRANT is later reviewed.
create policy "gatehouse_sites_owner_read" on public.gatehouse_customer_sites
 for select to authenticated
 using ((select auth.uid()) = owner_user_id);
-- Reports intentionally have no authenticated policies or grants. They cannot be released in v1.
