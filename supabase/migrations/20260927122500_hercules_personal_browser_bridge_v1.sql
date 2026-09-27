create extension if not exists pgcrypto;

create table if not exists public.hercules_personal_browser_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  pair_token_sha256 text not null unique,
  session_token_sha256 text unique,
  status text not null default 'waiting' check (status in ('waiting','connected','closed','expired')),
  approved_origin text,
  approved_tab_title text,
  browser_name text,
  connected_at timestamptz,
  last_seen_at timestamptz,
  expires_at timestamptz not null default (now()+interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hercules_personal_browser_commands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.hercules_personal_browser_sessions(id) on delete cascade,
  action text not null check (action in ('observe','click','type','navigate','close')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','claimed','succeeded','failed','cancelled')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

alter table public.hercules_personal_browser_sessions enable row level security;
alter table public.hercules_personal_browser_commands enable row level security;

revoke all on table public.hercules_personal_browser_sessions from public, anon, authenticated;
revoke all on table public.hercules_personal_browser_commands from public, anon, authenticated;
grant select,insert,update,delete on table public.hercules_personal_browser_sessions to service_role;
grant select,insert,update,delete on table public.hercules_personal_browser_commands to service_role;

create index if not exists hercules_personal_browser_sessions_owner_idx
  on public.hercules_personal_browser_sessions(owner_user_id,created_at desc);
create index if not exists hercules_personal_browser_commands_pending_idx
  on public.hercules_personal_browser_commands(session_id,status,created_at);

create or replace function public.hercules_personal_browser_command_submit(
  p_session_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_id uuid;
begin
  if p_action not in ('observe','click','type','navigate','close') then
    raise exception 'unsupported personal browser action';
  end if;

  if not exists (
    select 1
    from public.hercules_personal_browser_sessions s
    where s.id=p_session_id
      and s.status='connected'
      and s.expires_at>now()
  ) then
    raise exception 'personal browser session unavailable';
  end if;

  insert into public.hercules_personal_browser_commands(session_id,action,payload)
  values(p_session_id,p_action,coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.hercules_personal_browser_command_submit(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.hercules_personal_browser_command_submit(uuid,text,jsonb)
  to service_role;
