create table if not exists public.hercules_spaceship_auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'issued'
    check (status in ('issued','starting','launched','completed','expired','revoked')),
  authorization_url text,
  issued_at timestamptz not null default now(),
  launched_at timestamptz,
  last_opened_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (expires_at > issued_at)
);

alter table public.hercules_spaceship_auth_handoffs enable row level security;
alter table public.hercules_spaceship_auth_handoffs force row level security;
revoke all on table public.hercules_spaceship_auth_handoffs from public, anon, authenticated;
grant select, insert, update, delete on table public.hercules_spaceship_auth_handoffs to service_role;

create index if not exists hercules_spaceship_auth_handoffs_expires_idx
  on public.hercules_spaceship_auth_handoffs(expires_at);

comment on table public.hercules_spaceship_auth_handoffs is
  'Short-lived hashed owner handoffs for launching official Spaceship OAuth without exposing registrar credentials or PKCE verifiers.';
