create extension if not exists pgcrypto with schema extensions;

create table if not exists public.hercules_abyss_control_state (
  id text primary key check (id = 'primary'),
  emergency_stop_active boolean not null default true,
  event_head text not null default 'GENESIS',
  updated_at timestamptz not null default now()
);

insert into public.hercules_abyss_control_state(id, emergency_stop_active, event_head)
values ('primary', true, 'GENESIS')
on conflict (id) do nothing;

create table if not exists public.hercules_abyss_control_events (
  event_no bigint generated always as identity primary key,
  action text not null check (action in ('stop', 'resume')),
  actor uuid not null,
  previous_hash text not null,
  event_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.hercules_abyss_control_state enable row level security;
alter table public.hercules_abyss_control_events enable row level security;
revoke all on public.hercules_abyss_control_state from anon, authenticated;
revoke all on public.hercules_abyss_control_events from anon, authenticated;

create or replace function public.hercules_abyss_read_state()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  state_row public.hercules_abyss_control_state%rowtype;
  event_row public.hercules_abyss_control_events%rowtype;
  expected_hash text := 'GENESIS';
  calculated_hash text;
  audit_ok boolean := true;
begin
  select * into state_row from public.hercules_abyss_control_state where id = 'primary';
  if not found then
    return jsonb_build_object('emergency_stop_active', true, 'audit_trusted', false);
  end if;
  for event_row in select * from public.hercules_abyss_control_events order by event_no loop
    if event_row.previous_hash <> expected_hash then
      audit_ok := false;
      exit;
    end if;
    calculated_hash := encode(extensions.digest(convert_to(expected_hash || '|' || event_row.action || '|' || event_row.actor::text, 'UTF8'), 'sha256'), 'hex');
    if calculated_hash <> event_row.event_hash then
      audit_ok := false;
      exit;
    end if;
    expected_hash := event_row.event_hash;
  end loop;
  if expected_hash <> state_row.event_head then audit_ok := false; end if;
  return jsonb_build_object(
    'emergency_stop_active', state_row.emergency_stop_active,
    'audit_trusted', audit_ok,
    'event_head', state_row.event_head
  );
end;
$$;

create or replace function public.hercules_abyss_set_stop(p_action text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  state_row public.hercules_abyss_control_state%rowtype;
  current_state jsonb;
  next_hash text;
begin
  if p_action not in ('stop', 'resume') or p_actor is null then
    raise exception 'invalid_control_request';
  end if;
  select * into state_row from public.hercules_abyss_control_state where id = 'primary' for update;
  if not found then raise exception 'control_state_missing'; end if;
  current_state := public.hercules_abyss_read_state();
  if p_action = 'stop' then
    update public.hercules_abyss_control_state set emergency_stop_active = true, updated_at = now() where id = 'primary';
    if current_state->>'audit_trusted' = 'true' then
      next_hash := encode(extensions.digest(convert_to(state_row.event_head || '|stop|' || p_actor::text, 'UTF8'), 'sha256'), 'hex');
      insert into public.hercules_abyss_control_events(action, actor, previous_hash, event_hash)
      values ('stop', p_actor, state_row.event_head, next_hash);
      update public.hercules_abyss_control_state set event_head = next_hash where id = 'primary';
    end if;
  else
    if current_state->>'audit_trusted' <> 'true' then raise exception 'audit_chain_untrusted'; end if;
    next_hash := encode(extensions.digest(convert_to(state_row.event_head || '|resume|' || p_actor::text, 'UTF8'), 'sha256'), 'hex');
    insert into public.hercules_abyss_control_events(action, actor, previous_hash, event_hash)
    values ('resume', p_actor, state_row.event_head, next_hash);
    update public.hercules_abyss_control_state
      set emergency_stop_active = false, event_head = next_hash, updated_at = now()
      where id = 'primary';
  end if;
  return public.hercules_abyss_read_state();
end;
$$;

revoke all on function public.hercules_abyss_read_state() from public, anon, authenticated;
revoke all on function public.hercules_abyss_set_stop(text, uuid) from public, anon, authenticated;
grant execute on function public.hercules_abyss_read_state() to service_role;
grant execute on function public.hercules_abyss_set_stop(text, uuid) to service_role;
