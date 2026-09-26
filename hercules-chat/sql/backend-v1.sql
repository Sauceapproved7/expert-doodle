-- Hercules Chat Backend v1
-- Canonical, idempotent baseline matching the deployed Supabase chat backend.
-- Browser/mobile callers are restricted by RLS. Trusted assistant/tool/accounting
-- writes are service-role only.

create schema if not exists private;
grant usage on schema private to service_role;

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- User-facing chat state
-- ---------------------------------------------------------------------------

create table if not exists public.hercules_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  organization_id uuid
    references public.hercules_organizations(id) on delete set null,
  title text check (title is null or char_length(title) <= 200),
  status text not null default 'active'
    check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists hercules_chat_sessions_user_recent_idx
  on public.hercules_chat_sessions (user_id, last_message_at desc);

create index if not exists hercules_chat_sessions_org_idx
  on public.hercules_chat_sessions (organization_id, last_message_at desc)
  where organization_id is not null;


create table if not exists public.hercules_chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  user_id uuid not null default auth.uid(),
  parent_message_id bigint,
  role text not null
    check (role in ('user','assistant','system','tool')),
  status text not null default 'completed'
    check (status in ('pending','streaming','completed','failed','cancelled')),
  content jsonb not null,
  model text,
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  client_message_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (session_id, user_id)
    references public.hercules_chat_sessions (id, user_id)
    on delete cascade,
  foreign key (parent_message_id, user_id)
    references public.hercules_chat_messages (id, user_id)
    on delete set null,
  constraint hercules_chat_messages_content_size_chk
    check (octet_length(content::text) <= 262144)
);

create index if not exists hercules_chat_messages_session_order_idx
  on public.hercules_chat_messages (session_id, id);

create index if not exists hercules_chat_messages_user_idx
  on public.hercules_chat_messages (user_id, id desc);

create unique index if not exists hercules_chat_messages_client_id_idx
  on public.hercules_chat_messages (user_id, client_message_id)
  where client_message_id is not null;


create table if not exists public.hercules_chat_tool_calls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  message_id bigint,
  call_id text not null,
  tool_name text not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed','cancelled')),
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (session_id, user_id)
    references public.hercules_chat_sessions (id, user_id)
    on delete cascade,
  foreign key (message_id, user_id)
    references public.hercules_chat_messages (id, user_id)
    on delete cascade,
  unique (user_id, call_id)
);

create index if not exists hercules_chat_tool_calls_session_idx
  on public.hercules_chat_tool_calls (session_id, started_at desc);

create index if not exists hercules_chat_tool_calls_user_idx
  on public.hercules_chat_tool_calls (user_id, started_at desc);


create table if not exists public.hercules_chat_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id) on delete cascade,
  organization_id uuid
    references public.hercules_organizations(id) on delete set null,
  session_id uuid,
  source_message_id bigint,
  memory_type text not null default 'semantic'
    check (memory_type in ('semantic','preference','fact','summary','instruction')),
  content text not null
    check (char_length(content) between 1 and 12000),
  embedding_model text not null default 'gte-small',
  embedding extensions.vector(384),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  foreign key (session_id, user_id)
    references public.hercules_chat_sessions (id, user_id)
    on delete cascade,
  foreign key (source_message_id, user_id)
    references public.hercules_chat_messages (id, user_id)
    on delete set null
);

create index if not exists hercules_chat_memories_user_recent_idx
  on public.hercules_chat_memories (user_id, created_at desc);

create index if not exists hercules_chat_memories_org_idx
  on public.hercules_chat_memories (organization_id, created_at desc)
  where organization_id is not null;

create index if not exists hercules_chat_memories_embedding_hnsw_idx
  on public.hercules_chat_memories
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;


-- ---------------------------------------------------------------------------
-- Server-only execution, metering, and audit state
-- ---------------------------------------------------------------------------

create table if not exists private.hercules_ai_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  client_message_id uuid,
  state text not null default 'accepted'
    check (state in ('accepted','running','completed','failed','cancelled')),
  provider text not null default 'openai',
  model text,
  response_message_id bigint,
  error_code text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists hercules_ai_requests_user_created_idx
  on private.hercules_ai_requests (user_id, created_at desc);

create index if not exists hercules_ai_requests_session_idx
  on private.hercules_ai_requests (session_id, created_at desc)
  where session_id is not null;


create table if not exists private.hercules_model_pricing (
  id bigint generated always as identity primary key,
  provider text not null,
  model text not null,
  input_microusd_per_million bigint not null
    check (input_microusd_per_million >= 0),
  cached_input_microusd_per_million bigint
    check (cached_input_microusd_per_million is null or cached_input_microusd_per_million >= 0),
  output_microusd_per_million bigint not null
    check (output_microusd_per_million >= 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, model, effective_from)
);

create index if not exists hercules_model_pricing_lookup_idx
  on private.hercules_model_pricing (provider, model, effective_from desc);


create table if not exists private.hercules_usage_ledger (
  id bigint generated always as identity primary key,
  request_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  message_id bigint,
  provider text not null,
  model text not null,
  kind text not null default 'generation'
    check (kind in ('generation','embedding','tool','image','audio')),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  cached_input_tokens bigint not null default 0 check (cached_input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cost_microusd bigint not null default 0 check (cost_microusd >= 0),
  status text not null
    check (status in ('reserved','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists hercules_usage_ledger_user_time_idx
  on private.hercules_usage_ledger (user_id, created_at desc);

create index if not exists hercules_usage_ledger_session_idx
  on private.hercules_usage_ledger (session_id, created_at desc)
  where session_id is not null;

create index if not exists hercules_usage_ledger_open_idx
  on private.hercules_usage_ledger (user_id, created_at)
  where status = 'reserved';


create table if not exists private.hercules_ai_plan_limits (
  plan text primary key,
  requests_per_minute integer
    check (requests_per_minute is null or requests_per_minute > 0),
  requests_per_day integer
    check (requests_per_day is null or requests_per_day > 0),
  monthly_cost_microusd bigint
    check (monthly_cost_microusd is null or monthly_cost_microusd >= 0),
  max_output_tokens integer
    check (max_output_tokens is null or max_output_tokens > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into private.hercules_ai_plan_limits
  (plan, requests_per_minute, requests_per_day, monthly_cost_microusd, max_output_tokens, enabled)
values
  ('preview', 10, 100, null, 4096, true),
  ('pro', 60, 5000, null, 16384, true)
on conflict (plan) do nothing;


create table if not exists private.hercules_rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null check (bucket in ('minute','day')),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, bucket, window_start)
);


create table if not exists private.hercules_ai_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  provider text not null default 'openai',
  model text,
  status text not null
    check (status in ('queued','running','completed','failed','cancelled')),
  input_tokens bigint check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens is null or cached_input_tokens >= 0),
  output_tokens bigint check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists hercules_ai_runs_user_created_idx
  on private.hercules_ai_runs (user_id, created_at desc);

create unique index if not exists hercules_ai_runs_request_id_idx
  on private.hercules_ai_runs (request_id)
  where request_id is not null;


create table if not exists private.hercules_chat_audit_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  actor_type text not null
    check (actor_type in ('user','system','admin','integration')),
  event_type text not null,
  target_type text,
  target_id text,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hercules_chat_audit_events_user_time_idx
  on private.hercules_chat_audit_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists hercules_chat_audit_events_type_time_idx
  on private.hercules_chat_audit_events (event_type, created_at desc);


-- ---------------------------------------------------------------------------
-- Lifecycle triggers
-- ---------------------------------------------------------------------------

create or replace function private.hercules_chat_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists hercules_chat_sessions_set_updated_at
  on public.hercules_chat_sessions;

create trigger hercules_chat_sessions_set_updated_at
before update on public.hercules_chat_sessions
for each row
execute function private.hercules_chat_set_updated_at();


create or replace function private.hercules_chat_touch_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hercules_chat_sessions
     set last_message_at = greatest(last_message_at, new.created_at),
         updated_at = now()
   where id = new.session_id
     and user_id = new.user_id;
  return new;
end;
$$;

revoke all on function private.hercules_chat_touch_session() from public;
revoke all on function private.hercules_chat_touch_session() from anon, authenticated;

drop trigger if exists hercules_chat_messages_touch_session
  on public.hercules_chat_messages;

create trigger hercules_chat_messages_touch_session
after insert on public.hercules_chat_messages
for each row
execute function private.hercules_chat_touch_session();


-- ---------------------------------------------------------------------------
-- RLS + least-privilege grants
-- ---------------------------------------------------------------------------

alter table public.hercules_chat_sessions enable row level security;
alter table public.hercules_chat_messages enable row level security;
alter table public.hercules_chat_tool_calls enable row level security;
alter table public.hercules_chat_memories enable row level security;

alter table private.hercules_ai_requests enable row level security;
alter table private.hercules_model_pricing enable row level security;
alter table private.hercules_usage_ledger enable row level security;
alter table private.hercules_ai_plan_limits enable row level security;
alter table private.hercules_rate_limit_buckets enable row level security;
alter table private.hercules_ai_runs enable row level security;
alter table private.hercules_chat_audit_events enable row level security;

revoke all on table public.hercules_chat_sessions from anon, authenticated;
revoke all on table public.hercules_chat_messages from anon, authenticated;
revoke all on table public.hercules_chat_tool_calls from anon, authenticated;
revoke all on table public.hercules_chat_memories from anon, authenticated;

revoke all on table private.hercules_ai_requests from anon, authenticated;
revoke all on table private.hercules_model_pricing from anon, authenticated;
revoke all on table private.hercules_usage_ledger from anon, authenticated;
revoke all on table private.hercules_ai_plan_limits from anon, authenticated;
revoke all on table private.hercules_rate_limit_buckets from anon, authenticated;
revoke all on table private.hercules_ai_runs from anon, authenticated;
revoke all on table private.hercules_chat_audit_events from anon, authenticated;

grant select, delete on public.hercules_chat_sessions to authenticated;
grant insert (title, metadata) on public.hercules_chat_sessions to authenticated;
grant update (title, status, metadata) on public.hercules_chat_sessions to authenticated;

grant select on public.hercules_chat_messages to authenticated;
grant insert (session_id, parent_message_id, role, content, client_message_id, metadata)
  on public.hercules_chat_messages to authenticated;

grant select on public.hercules_chat_tool_calls to authenticated;
grant select, delete on public.hercules_chat_memories to authenticated;

grant select, insert, update, delete
on public.hercules_chat_sessions,
   public.hercules_chat_messages,
   public.hercules_chat_tool_calls,
   public.hercules_chat_memories
to service_role;

grant select, insert, update, delete
on private.hercules_ai_requests,
   private.hercules_model_pricing,
   private.hercules_usage_ledger,
   private.hercules_ai_plan_limits,
   private.hercules_rate_limit_buckets,
   private.hercules_ai_runs,
   private.hercules_chat_audit_events
to service_role;


drop policy if exists hercules_chat_sessions_select_own
  on public.hercules_chat_sessions;
create policy hercules_chat_sessions_select_own
on public.hercules_chat_sessions
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists hercules_chat_sessions_insert_own
  on public.hercules_chat_sessions;
create policy hercules_chat_sessions_insert_own
on public.hercules_chat_sessions
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists hercules_chat_sessions_update_own
  on public.hercules_chat_sessions;
create policy hercules_chat_sessions_update_own
on public.hercules_chat_sessions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists hercules_chat_sessions_delete_own
  on public.hercules_chat_sessions;
create policy hercules_chat_sessions_delete_own
on public.hercules_chat_sessions
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists hercules_chat_messages_select_own
  on public.hercules_chat_messages;
create policy hercules_chat_messages_select_own
on public.hercules_chat_messages
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists hercules_chat_messages_insert_user
  on public.hercules_chat_messages;
create policy hercules_chat_messages_insert_user
on public.hercules_chat_messages
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and role = 'user'
  and status = 'completed'
);

drop policy if exists hercules_chat_tool_calls_select_own
  on public.hercules_chat_tool_calls;
create policy hercules_chat_tool_calls_select_own
on public.hercules_chat_tool_calls
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists hercules_chat_memories_select_own
  on public.hercules_chat_memories;
create policy hercules_chat_memories_select_own
on public.hercules_chat_memories
for select to authenticated
using (
  (select auth.uid()) = user_id
  and (expires_at is null or expires_at > now())
);

drop policy if exists hercules_chat_memories_delete_own
  on public.hercules_chat_memories;
create policy hercules_chat_memories_delete_own
on public.hercules_chat_memories
for delete to authenticated
using ((select auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- Semantic memory RPC
-- ---------------------------------------------------------------------------

create or replace function public.hercules_match_chat_memories(
  query_embedding extensions.vector(384),
  match_threshold real default 0.72,
  match_count integer default 8
)
returns table (
  id uuid,
  session_id uuid,
  source_message_id bigint,
  memory_type text,
  content text,
  metadata jsonb,
  similarity real,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.session_id,
    m.source_message_id,
    m.memory_type,
    m.content,
    m.metadata,
    (1 - (m.embedding OPERATOR(extensions.<=>) query_embedding))::real,
    m.created_at
  from public.hercules_chat_memories m
  where m.user_id = (select auth.uid())
    and m.embedding_model = 'gte-small'
    and m.embedding is not null
    and (m.expires_at is null or m.expires_at > now())
    and (1 - (m.embedding OPERATOR(extensions.<=>) query_embedding)) > match_threshold
  order by m.embedding OPERATOR(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

revoke all on function public.hercules_match_chat_memories(
  extensions.vector, real, integer
) from public, anon;
grant execute on function public.hercules_match_chat_memories(
  extensions.vector, real, integer
) to authenticated;


-- ---------------------------------------------------------------------------
-- Backend-only generation, tools, metering
-- ---------------------------------------------------------------------------

create or replace function private.hercules_reserve_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_session_id uuid,
  p_provider text,
  p_model text,
  p_reserved_cost_microusd bigint default 0
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing bigint;
  v_plan text;
  v_limit private.hercules_ai_plan_limits%rowtype;
  v_minute_count integer;
  v_day_count integer;
  v_month_cost bigint;
  v_ledger_id bigint;
begin
  if p_reserved_cost_microusd < 0 then
    raise exception 'INVALID_RESERVED_COST';
  end if;

  if not exists (
    select 1
    from public.hercules_chat_sessions s
    where s.id = p_session_id and s.user_id = p_user_id
  ) then
    raise exception 'SESSION_NOT_OWNED_BY_USER';
  end if;

  select id into v_existing
  from private.hercules_usage_ledger
  where request_id = p_request_id;

  if found then
    return v_existing;
  end if;

  select coalesce(
    (
      select b.plan
      from public.hercules_billing b
      where b.user_id = p_user_id
        and b.status not in ('canceled','cancelled','inactive')
      limit 1
    ),
    'preview'
  )
  into v_plan;

  select * into v_limit
  from private.hercules_ai_plan_limits
  where plan = v_plan and enabled = true;

  if not found then
    raise exception 'AI_PLAN_NOT_ENABLED';
  end if;

  insert into private.hercules_rate_limit_buckets
    (user_id, bucket, window_start, request_count)
  values
    (p_user_id, 'minute', date_trunc('minute', now()), 1)
  on conflict (user_id, bucket, window_start)
  do update set request_count =
    private.hercules_rate_limit_buckets.request_count + 1
  returning request_count into v_minute_count;

  if v_limit.requests_per_minute is not null
     and v_minute_count > v_limit.requests_per_minute then
    raise exception 'RATE_LIMIT_MINUTE_EXCEEDED';
  end if;

  insert into private.hercules_rate_limit_buckets
    (user_id, bucket, window_start, request_count)
  values
    (p_user_id, 'day', date_trunc('day', now()), 1)
  on conflict (user_id, bucket, window_start)
  do update set request_count =
    private.hercules_rate_limit_buckets.request_count + 1
  returning request_count into v_day_count;

  if v_limit.requests_per_day is not null
     and v_day_count > v_limit.requests_per_day then
    raise exception 'RATE_LIMIT_DAY_EXCEEDED';
  end if;

  if v_limit.monthly_cost_microusd is not null then
    select coalesce(sum(cost_microusd), 0)
      into v_month_cost
      from private.hercules_usage_ledger
     where user_id = p_user_id
       and created_at >= date_trunc('month', now())
       and status in ('reserved','completed');

    if v_month_cost + p_reserved_cost_microusd >
       v_limit.monthly_cost_microusd then
      raise exception 'MONTHLY_AI_BUDGET_EXCEEDED';
    end if;
  end if;

  insert into private.hercules_ai_requests (
    id, user_id, session_id, state, provider, model
  ) values (
    p_request_id, p_user_id, p_session_id, 'accepted', p_provider, p_model
  )
  on conflict (id) do nothing;

  insert into private.hercules_usage_ledger (
    request_id, user_id, session_id, provider, model, cost_microusd, status
  ) values (
    p_request_id, p_user_id, p_session_id, p_provider, p_model,
    p_reserved_cost_microusd, 'reserved'
  )
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

revoke all on function private.hercules_reserve_ai_request(
  uuid, uuid, uuid, text, text, bigint
) from public, anon, authenticated;
grant execute on function private.hercules_reserve_ai_request(
  uuid, uuid, uuid, text, text, bigint
) to service_role;


create or replace function private.hercules_finalize_ai_request(
  p_request_id uuid,
  p_status text,
  p_input_tokens bigint default 0,
  p_cached_input_tokens bigint default 0,
  p_output_tokens bigint default 0,
  p_actual_cost_microusd bigint default 0,
  p_response_message_id bigint default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_status not in ('completed','failed','cancelled') then
    raise exception 'INVALID_FINAL_STATUS';
  end if;

  if p_input_tokens < 0
     or p_cached_input_tokens < 0
     or p_output_tokens < 0
     or p_actual_cost_microusd < 0 then
    raise exception 'INVALID_USAGE_VALUES';
  end if;

  update private.hercules_usage_ledger
     set input_tokens = p_input_tokens,
         cached_input_tokens = p_cached_input_tokens,
         output_tokens = p_output_tokens,
         cost_microusd = p_actual_cost_microusd,
         status = p_status,
         completed_at = now()
   where request_id = p_request_id
     and status = 'reserved'
   returning user_id into v_user_id;

  update private.hercules_ai_requests
     set state = p_status,
         response_message_id = p_response_message_id,
         error_code = p_error_code,
         completed_at = now()
   where id = p_request_id;

  if v_user_id is not null and p_status = 'completed' then
    insert into public.hercules_usage (user_id, period, ai_runs, updated_at)
    values (v_user_id, to_char(now(),'YYYY-MM'), 1, now())
    on conflict (user_id, period)
    do update set
      ai_runs = public.hercules_usage.ai_runs + 1,
      updated_at = now();
  end if;

  insert into private.hercules_chat_audit_events (
    user_id, actor_type, event_type, target_type, target_id, request_id, metadata
  )
  select
    r.user_id,
    'integration',
    'ai.request.' || p_status,
    'ai_request',
    p_request_id::text,
    p_request_id,
    jsonb_build_object(
      'provider', r.provider,
      'model', r.model,
      'input_tokens', p_input_tokens,
      'cached_input_tokens', p_cached_input_tokens,
      'output_tokens', p_output_tokens,
      'cost_microusd', p_actual_cost_microusd,
      'error_code', p_error_code
    )
  from private.hercules_ai_requests r
  where r.id = p_request_id;
end;
$$;

revoke all on function private.hercules_finalize_ai_request(
  uuid, text, bigint, bigint, bigint, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function private.hercules_finalize_ai_request(
  uuid, text, bigint, bigint, bigint, bigint, bigint, text
) to service_role;


create or replace function private.hercules_append_chat_message(
  p_user_id uuid,
  p_session_id uuid,
  p_role text,
  p_content jsonb,
  p_model text default null,
  p_input_tokens bigint default null,
  p_output_tokens bigint default null,
  p_parent_message_id bigint default null,
  p_metadata jsonb default '{}'::jsonb,
  p_status text default 'completed'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_role not in ('assistant','system','tool') then
    raise exception 'TRUSTED_ROLE_REQUIRED';
  end if;

  if p_status not in ('pending','streaming','completed','failed','cancelled') then
    raise exception 'INVALID_MESSAGE_STATUS';
  end if;

  if not exists (
    select 1
    from public.hercules_chat_sessions s
    where s.id = p_session_id and s.user_id = p_user_id
  ) then
    raise exception 'SESSION_NOT_OWNED_BY_USER';
  end if;

  insert into public.hercules_chat_messages (
    session_id, user_id, parent_message_id, role, status, content,
    model, input_tokens, output_tokens, metadata
  )
  values (
    p_session_id, p_user_id, p_parent_message_id, p_role, p_status, p_content,
    p_model, p_input_tokens, p_output_tokens, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.hercules_append_chat_message(
  uuid, uuid, text, jsonb, text, bigint, bigint, bigint, jsonb, text
) from public, anon, authenticated;
grant execute on function private.hercules_append_chat_message(
  uuid, uuid, text, jsonb, text, bigint, bigint, bigint, jsonb, text
) to service_role;


create or replace function private.hercules_start_chat_tool_call(
  p_user_id uuid,
  p_session_id uuid,
  p_message_id bigint,
  p_call_id text,
  p_tool_name text,
  p_arguments jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1
    from public.hercules_chat_sessions s
    where s.id = p_session_id and s.user_id = p_user_id
  ) then
    raise exception 'SESSION_NOT_OWNED_BY_USER';
  end if;

  insert into public.hercules_chat_tool_calls (
    session_id, user_id, message_id, call_id, tool_name,
    arguments, status, metadata
  )
  values (
    p_session_id, p_user_id, p_message_id, p_call_id, p_tool_name,
    coalesce(p_arguments, '{}'::jsonb), 'running',
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, call_id) do update
    set status = 'running',
        arguments = excluded.arguments,
        tool_name = excluded.tool_name,
        error_code = null,
        error_message = null,
        completed_at = null
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.hercules_start_chat_tool_call(
  uuid, uuid, bigint, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.hercules_start_chat_tool_call(
  uuid, uuid, bigint, text, text, jsonb, jsonb
) to service_role;


create or replace function private.hercules_finish_chat_tool_call(
  p_user_id uuid,
  p_call_id text,
  p_status text,
  p_result jsonb default null,
  p_error_code text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed','failed','cancelled') then
    raise exception 'INVALID_TOOL_STATUS';
  end if;

  update public.hercules_chat_tool_calls
     set status = p_status,
         result = p_result,
         error_code = p_error_code,
         error_message = p_error_message,
         completed_at = now()
   where user_id = p_user_id
     and call_id = p_call_id;

  if not found then
    raise exception 'TOOL_CALL_NOT_FOUND';
  end if;
end;
$$;

revoke all on function private.hercules_finish_chat_tool_call(
  uuid, text, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function private.hercules_finish_chat_tool_call(
  uuid, text, text, jsonb, text, text
) to service_role;


-- Public-schema wrappers exist only so the server-side Edge Function can reach
-- private functions through PostgREST. Execution remains service-role only.

create or replace function public.hercules_chat_reserve_ai_request(
  p_user_id uuid,
  p_request_id uuid,
  p_session_id uuid,
  p_provider text,
  p_model text,
  p_reserved_cost_microusd bigint default 0
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.hercules_reserve_ai_request(
    p_user_id, p_request_id, p_session_id, p_provider, p_model,
    p_reserved_cost_microusd
  );
$$;

revoke all on function public.hercules_chat_reserve_ai_request(
  uuid, uuid, uuid, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.hercules_chat_reserve_ai_request(
  uuid, uuid, uuid, text, text, bigint
) to service_role;


create or replace function public.hercules_chat_finalize_ai_request(
  p_request_id uuid,
  p_status text,
  p_input_tokens bigint default 0,
  p_cached_input_tokens bigint default 0,
  p_output_tokens bigint default 0,
  p_actual_cost_microusd bigint default 0,
  p_response_message_id bigint default null,
  p_error_code text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.hercules_finalize_ai_request(
    p_request_id, p_status, p_input_tokens, p_cached_input_tokens,
    p_output_tokens, p_actual_cost_microusd, p_response_message_id, p_error_code
  );
$$;

revoke all on function public.hercules_chat_finalize_ai_request(
  uuid, text, bigint, bigint, bigint, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.hercules_chat_finalize_ai_request(
  uuid, text, bigint, bigint, bigint, bigint, bigint, text
) to service_role;


create or replace function public.hercules_chat_current_usage()
returns table (
  plan text,
  period text,
  ai_runs integer,
  request_count bigint,
  input_tokens bigint,
  cached_input_tokens bigint,
  output_tokens bigint,
  cost_microusd bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid
  ),
  billing as (
    select coalesce(
      (
        select b.plan
        from public.hercules_billing b, me
        where b.user_id = me.uid
        limit 1
      ),
      'preview'
    ) as plan
  ),
  agg as (
    select
      count(*) filter (where l.status = 'completed') as request_count,
      coalesce(sum(l.input_tokens) filter (where l.status = 'completed'), 0)::bigint as input_tokens,
      coalesce(sum(l.cached_input_tokens) filter (where l.status = 'completed'), 0)::bigint as cached_input_tokens,
      coalesce(sum(l.output_tokens) filter (where l.status = 'completed'), 0)::bigint as output_tokens,
      coalesce(sum(l.cost_microusd) filter (where l.status = 'completed'), 0)::bigint as cost_microusd
    from private.hercules_usage_ledger l, me
    where l.user_id = me.uid
      and l.created_at >= date_trunc('month', now())
  )
  select
    billing.plan,
    to_char(now(), 'YYYY-MM'),
    coalesce(
      (
        select u.ai_runs
        from public.hercules_usage u, me
        where u.user_id = me.uid
          and u.period = to_char(now(), 'YYYY-MM')
      ),
      0
    )::integer,
    agg.request_count,
    agg.input_tokens,
    agg.cached_input_tokens,
    agg.output_tokens,
    agg.cost_microusd
  from billing, agg
  where (select uid from me) is not null;
$$;

revoke all on function public.hercules_chat_current_usage()
from public, anon;
grant execute on function public.hercules_chat_current_usage()
to authenticated;


-- ---------------------------------------------------------------------------
-- Retention + Realtime
-- ---------------------------------------------------------------------------

create or replace function private.hercules_chat_cleanup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.hercules_rate_limit_buckets
   where window_start < now() - interval '2 days';

  delete from private.hercules_ai_runs
   where created_at < now() - interval '90 days';

  delete from public.hercules_chat_memories
   where expires_at is not null
     and expires_at <= now();
end;
$$;

revoke all on function private.hercules_chat_cleanup()
from public, anon, authenticated;
grant execute on function private.hercules_chat_cleanup()
to service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and not exists (
       select 1 from cron.job where jobname = 'hercules-chat-cleanup'
     ) then
    perform cron.schedule(
      'hercules-chat-cleanup',
      '37 3 * * *',
      'select private.hercules_chat_cleanup();'
    );
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'hercules_chat_messages'
     ) then
    alter publication supabase_realtime
      add table public.hercules_chat_messages;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'hercules_chat_tool_calls'
     ) then
    alter publication supabase_realtime
      add table public.hercules_chat_tool_calls;
  end if;
end
$$;

comment on table public.hercules_chat_sessions is
  'Hercules user-owned chat session index protected by Supabase RLS.';
comment on table public.hercules_chat_messages is
  'Append-oriented Hercules chat log. Browser clients may create user messages only.';
comment on table public.hercules_chat_memories is
  'User-owned semantic chat memory using 384-dimensional gte-small embeddings.';
comment on table private.hercules_usage_ledger is
  'Server-only idempotent AI request usage ledger and reservation state.';
