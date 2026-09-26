create table if not exists public.hercules_revenue_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  contact_id uuid null references public.marketing_contacts(id) on delete set null,
  source text not null default 'inbound',
  external_key text null,
  status text not null default 'new' check (status in ('new','contacting','engaged','booked','won','lost','opted_out','human_handoff')),
  first_name text null,
  last_name text null,
  email text null,
  phone text null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  estimated_value_cents bigint not null default 0 check (estimated_value_cents >= 0),
  allowed_channels text[] not null default array[]::text[] check (allowed_channels <@ array['sms','email','voice','internal']::text[]),
  context jsonb not null default '{}'::jsonb,
  last_inbound_at timestamptz null,
  last_outbound_at timestamptz null,
  next_follow_up_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hercules_revenue_leads_contact_route check (email is not null or phone is not null),
  constraint hercules_revenue_leads_source_external_unique unique (organization_id, source, external_key)
);

create table if not exists public.hercules_revenue_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  lead_id uuid not null references public.hercules_revenue_leads(id) on delete cascade,
  kind text not null default 'follow_up' check (kind in ('follow_up','booking','human_handoff','reactivation')),
  channel text not null check (channel in ('sms','email','voice','internal')),
  state text not null default 'queued' check (state in ('queued','claimed','sent','completed','failed','cancelled')),
  template_key text null,
  idempotency_key text not null,
  due_at timestamptz not null,
  claimed_at timestamptz null,
  completed_at timestamptz null,
  attempts integer not null default 0 check (attempts >= 0),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hercules_revenue_actions_idempotency_unique unique (organization_id, idempotency_key)
);

create table if not exists public.hercules_revenue_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  lead_id uuid not null references public.hercules_revenue_leads(id) on delete cascade,
  event_name text not null,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists hercules_revenue_leads_org_status_idx
  on public.hercules_revenue_leads (organization_id, status, created_at desc);
create index if not exists hercules_revenue_actions_due_idx
  on public.hercules_revenue_actions (organization_id, state, due_at)
  where state in ('queued','claimed');
create index if not exists hercules_revenue_events_org_time_idx
  on public.hercules_revenue_events (organization_id, occurred_at desc);
create index if not exists hercules_revenue_events_lead_idx
  on public.hercules_revenue_events (lead_id, occurred_at desc);

alter table public.hercules_revenue_leads enable row level security;
alter table public.hercules_revenue_actions enable row level security;
alter table public.hercules_revenue_events enable row level security;

revoke all on table public.hercules_revenue_leads from anon;
revoke all on table public.hercules_revenue_actions from anon;
revoke all on table public.hercules_revenue_events from anon;

grant select, insert, update, delete on table public.hercules_revenue_leads to authenticated;
grant select, insert, update, delete on table public.hercules_revenue_actions to authenticated;
grant select, insert on table public.hercules_revenue_events to authenticated;

drop policy if exists hercules_revenue_leads_select on public.hercules_revenue_leads;
create policy hercules_revenue_leads_select on public.hercules_revenue_leads
for select to authenticated using (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_leads_insert on public.hercules_revenue_leads;
create policy hercules_revenue_leads_insert on public.hercules_revenue_leads
for insert to authenticated with check (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_leads_update on public.hercules_revenue_leads;
create policy hercules_revenue_leads_update on public.hercules_revenue_leads
for update to authenticated
using (private.hercules_is_member(organization_id))
with check (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_leads_delete on public.hercules_revenue_leads;
create policy hercules_revenue_leads_delete on public.hercules_revenue_leads
for delete to authenticated using (private.hercules_is_admin(organization_id));

drop policy if exists hercules_revenue_actions_select on public.hercules_revenue_actions;
create policy hercules_revenue_actions_select on public.hercules_revenue_actions
for select to authenticated using (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_actions_insert on public.hercules_revenue_actions;
create policy hercules_revenue_actions_insert on public.hercules_revenue_actions
for insert to authenticated with check (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_actions_update on public.hercules_revenue_actions;
create policy hercules_revenue_actions_update on public.hercules_revenue_actions
for update to authenticated
using (private.hercules_is_member(organization_id))
with check (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_actions_delete on public.hercules_revenue_actions;
create policy hercules_revenue_actions_delete on public.hercules_revenue_actions
for delete to authenticated using (private.hercules_is_admin(organization_id));

drop policy if exists hercules_revenue_events_select on public.hercules_revenue_events;
create policy hercules_revenue_events_select on public.hercules_revenue_events
for select to authenticated using (private.hercules_is_member(organization_id));

drop policy if exists hercules_revenue_events_insert on public.hercules_revenue_events;
create policy hercules_revenue_events_insert on public.hercules_revenue_events
for insert to authenticated with check (private.hercules_is_member(organization_id));

create or replace view public.hercules_revenue_dashboard
with (security_invoker = true)
as
with event_rollup as (
  select organization_id, lead_id,
    coalesce(sum(amount_cents) filter (where event_name = 'won'), 0)::bigint as recovered_revenue_cents
  from public.hercules_revenue_events
  group by organization_id, lead_id
), action_rollup as (
  select organization_id, lead_id,
    count(*) filter (where state = 'queued')::bigint as queued_actions,
    count(*) filter (where state = 'failed')::bigint as failed_actions
  from public.hercules_revenue_actions
  group by organization_id, lead_id
)
select
  l.organization_id,
  count(*)::bigint as total_leads,
  count(*) filter (where l.status in ('engaged','booked','won'))::bigint as engaged_leads,
  count(*) filter (where l.status = 'booked')::bigint as booked_leads,
  count(*) filter (where l.status = 'won')::bigint as won_leads,
  coalesce(sum(er.recovered_revenue_cents), 0)::bigint as recovered_revenue_cents,
  coalesce(sum(ar.queued_actions), 0)::bigint as queued_actions,
  coalesce(sum(ar.failed_actions), 0)::bigint as failed_actions,
  case when count(*) = 0 then 0::numeric
       else (count(*) filter (where l.status = 'won'))::numeric / count(*)::numeric
  end as recovery_rate
from public.hercules_revenue_leads l
left join event_rollup er on er.organization_id = l.organization_id and er.lead_id = l.id
left join action_rollup ar on ar.organization_id = l.organization_id and ar.lead_id = l.id
group by l.organization_id;

grant select on public.hercules_revenue_dashboard to authenticated;

comment on table public.hercules_revenue_leads is 'Hercules Revenue Rescue: recoverable inbound opportunities scoped to an organization.';
comment on table public.hercules_revenue_actions is 'Hercules Revenue Rescue: consent-aware follow-up and handoff action queue.';
comment on table public.hercules_revenue_events is 'Hercules Revenue Rescue: append-only lifecycle and recovered-revenue events.';
