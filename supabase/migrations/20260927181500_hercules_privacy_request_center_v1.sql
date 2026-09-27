create table if not exists public.hercules_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  public_reference uuid not null default gen_random_uuid() unique,
  category text not null check (category in (
    'privacy_access',
    'privacy_export',
    'privacy_correction',
    'privacy_deletion',
    'privacy_question',
    'support',
    'legal_inquiry'
  )),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'new' check (status in (
    'new',
    'acknowledged',
    'verifying',
    'in_progress',
    'completed',
    'rejected'
  )),
  requester_verified boolean not null default false,
  verification_method text,
  resolution jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hercules_privacy_requests enable row level security;

revoke all on table public.hercules_privacy_requests from anon, authenticated;

create index if not exists hercules_privacy_requests_status_created_idx
  on public.hercules_privacy_requests(status,created_at desc);

create index if not exists hercules_privacy_requests_email_created_idx
  on public.hercules_privacy_requests(lower(email),created_at desc);

comment on table public.hercules_privacy_requests is
  'Hercules Privacy Request Center intake. Client roles have no direct table access. Requests start unverified and require identity/authority verification before export, correction, or deletion fulfillment.';
