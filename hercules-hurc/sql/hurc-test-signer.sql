create table if not exists public.hercules_hurc_test_signers (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network = 'base-sepolia'),
  chain_id bigint not null check (chain_id = 84532),
  address text not null unique check (address ~ '^0x[0-9a-f]{40}$'),
  secret_ref uuid not null,
  status text not null default 'active' check (status in ('active','used','revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.hercules_hurc_test_signers enable row level security;

comment on table public.hercules_hurc_test_signers is
  'Server-only Base Sepolia HURC test signer metadata. Private keys live in Supabase Vault, never in this table.';
