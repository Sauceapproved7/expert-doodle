create table if not exists public.hercules_pilot_outreach_queue (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  domain text not null unique,
  public_company_route text null,
  route_kind text not null check (route_kind in ('role_mailbox','company_contact_page','company_route_pending')),
  message_subject text not null,
  message_body text not null,
  tracking_url text not null,
  content_id text not null unique,
  source_evidence jsonb not null default '{}'::jsonb,
  status text not null default 'prepared' check (status in ('prepared','reviewed','authorized','sent','suppressed','invalid')),
  suppressed boolean not null default false,
  authorized_at timestamptz null,
  sent_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hercules_pilot_outreach_queue enable row level security;

revoke all on public.hercules_pilot_outreach_queue from public, anon, authenticated;
grant select, insert, update on public.hercules_pilot_outreach_queue to service_role;

comment on table public.hercules_pilot_outreach_queue is
  'Company-level, draft-only Hercules Founding Pilot prospect queue. No send implementation and no personal-contact fields.';

insert into public.hercules_pilot_outreach_queue (
  account_name,
  domain,
  public_company_route,
  route_kind,
  message_subject,
  message_body,
  tracking_url,
  content_id,
  source_evidence,
  status,
  suppressed
) values
(
  'Crystalia Glass',
  'crystaliaglass.com',
  'mailto:accounting@crystaliaglass.com',
  'role_mailbox',
  'A controlled way to triage overdue project receivables',
  'Crystalia already separates project bids and Accounts Payable/Receivable. Hercules Revenue Recovery is a controlled pilot for separating routine overdue invoices from disputes and active payment promises before follow-up. The workflow keeps consequential action approval-gated and preserves the evidence trail. The short proof is linked below if this is relevant to your finance/operations workflow.',
  'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?utm_source=targeted_outbound&utm_medium=direct_outreach&utm_campaign=founding-pilot-organic-v1&utm_content=acct-crystalia-glass-01#proof-overdue-invoices',
  'acct-crystalia-glass-01',
  jsonb_build_object(
    'source','company_public_web',
    'evidence',jsonb_build_array(
      'commercial/custom glass project model',
      'public Accounts Payable/Receivable company mailbox',
      'multi-state delivery/install footprint'
    )
  ),
  'prepared',
  false
),
(
  'JK Welding',
  'jkwelding.net',
  'mailto:sales@jkwelding.net',
  'role_mailbox',
  'Receivables follow-up for custom project work',
  'JK Welding runs custom commercial and industrial fabrication work where quotes, projects, suppliers, and customer follow-up can create different receivable states. Hercules Revenue Recovery is a controlled pilot that separates routine late invoices from disputes and payment promises before any consequential follow-up is allowed. The short proof is linked below.',
  'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?utm_source=targeted_outbound&utm_medium=direct_outreach&utm_campaign=founding-pilot-organic-v1&utm_content=acct-jk-welding-01#proof-overdue-invoices',
  'acct-jk-welding-01',
  jsonb_build_object(
    'source','company_public_web',
    'evidence',jsonb_build_array(
      'commercial and industrial custom fabrication',
      'quote/project-based work',
      'public company sales mailbox'
    )
  ),
  'prepared',
  false
),
(
  'Marchon Partners',
  'marchonpartners.com',
  null,
  'company_route_pending',
  'One controlled receivables workflow across staffing and consulting',
  'Marchon Partners operates across staffing, consulting, payroll services, MSP, and RPO. Hercules Revenue Recovery is a controlled pilot for centralizing overdue receivable follow-up while keeping disputes, active promises, and consequential actions visibly separated and approval-gated. The evidence-first proof is linked below.',
  'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?utm_source=targeted_outbound&utm_medium=direct_outreach&utm_campaign=founding-pilot-organic-v1&utm_content=acct-marchon-partners-01#proof-overdue-invoices',
  'acct-marchon-partners-01',
  jsonb_build_object(
    'source','company_public_web',
    'evidence',jsonb_build_array(
      'staffing and consulting services',
      'payroll/MSP/RPO services',
      'project and vendor complexity'
    )
  ),
  'prepared',
  false
),
(
  'Blue Signal Search',
  'bluesignal.com',
  'https://bluesignal.com/contact/',
  'company_contact_page',
  'Different billing models need different receivables routes',
  'Blue Signal uses retained, engaged, contingent, contract staffing, and subscription-style recruiting models. Hercules Revenue Recovery is a controlled pilot for separating what needs routine follow-up from what needs review or a hold, with visible evidence and approval gates. The short workflow proof is linked below.',
  'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?utm_source=targeted_outbound&utm_medium=direct_outreach&utm_campaign=founding-pilot-organic-v1&utm_content=acct-blue-signal-01#proof-overdue-invoices',
  'acct-blue-signal-01',
  jsonb_build_object(
    'source','company_public_web',
    'evidence',jsonb_build_array(
      'retained and engaged search',
      'contingent and contract staffing',
      'subscription-style Recruiting-as-a-Service'
    )
  ),
  'prepared',
  false
),
(
  'East 57th Street Partners',
  'e57partners.com',
  null,
  'company_route_pending',
  'Controlled receivables follow-up for project-based advisory work',
  'East 57th Street Partners provides business advisory and professional staffing across accounting, finance, HR, and IT. Hercules Revenue Recovery is a controlled pilot for keeping project receivable follow-up in one evidence-backed workflow while preserving human review for disputed or otherwise sensitive cases. The proof is linked below.',
  'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-launch?utm_source=targeted_outbound&utm_medium=direct_outreach&utm_campaign=founding-pilot-organic-v1&utm_content=acct-e57partners-01#proof-overdue-invoices',
  'acct-e57partners-01',
  jsonb_build_object(
    'source','company_public_web',
    'evidence',jsonb_build_array(
      'business advisory and professional staffing',
      'accounting and finance service capability',
      'on-demand project teams'
    )
  ),
  'prepared',
  false
)
on conflict (domain) do update set
  public_company_route=excluded.public_company_route,
  route_kind=excluded.route_kind,
  message_subject=excluded.message_subject,
  message_body=excluded.message_body,
  tracking_url=excluded.tracking_url,
  content_id=excluded.content_id,
  source_evidence=excluded.source_evidence,
  updated_at=now()
where public.hercules_pilot_outreach_queue.status in ('prepared','reviewed')
  and public.hercules_pilot_outreach_queue.suppressed=false;
