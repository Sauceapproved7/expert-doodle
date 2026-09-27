alter table private.hercules_domain_agent_audit
  drop constraint if exists hercules_domain_agent_audit_action_check;
alter table private.hercules_domain_agent_audit
  add constraint hercules_domain_agent_audit_action_check
  check (action in ('task_preflight','grant_status','execute','execution_status','usage_status'));

alter table private.hercules_domain_agent_audit
  drop constraint if exists hercules_domain_agent_audit_principal_type_check;
alter table private.hercules_domain_agent_audit
  add constraint hercules_domain_agent_audit_principal_type_check
  check (principal_type in ('owner-admin','hercules-internal','api-key'));

create table if not exists private.hercules_domain_agent_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 128),
  metric text not null check (metric in ('execution')),
  quantity integer not null check (quantity between 1 and 1000),
  period_start date not null,
  source text not null check (source in ('owner-admin','hercules-internal','api-key')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(organization_id,request_id,metric)
);

alter table private.hercules_domain_agent_usage enable row level security;
revoke all on table private.hercules_domain_agent_usage from public, anon, authenticated;

create index if not exists hercules_domain_agent_usage_org_period_idx
  on private.hercules_domain_agent_usage(organization_id,period_start,metric);

comment on table private.hercules_domain_agent_usage is
  'Credential-free monthly usage ledger for Hercules Domain Agent commercial metering.';

create table if not exists private.hercules_domain_agent_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  hostname text not null unique check (
    hostname ~ '^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  ),
  hosting_provider text not null check (hosting_provider in ('netlify','render','vercel','custom')),
  target_host text not null,
  hosting_alias_status text not null default 'pending'
    check (hosting_alias_status in ('pending','configured','error')),
  dns_provider text not null,
  dns_status text not null default 'pending_authorization'
    check (dns_status in ('pending_authorization','pending','configured','verified','error')),
  ssl_status text not null default 'pending'
    check (ssl_status in ('pending','active','error')),
  white_label boolean not null default false,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,hostname)
);

alter table private.hercules_domain_agent_identities enable row level security;
revoke all on table private.hercules_domain_agent_identities from public, anon, authenticated;

comment on table private.hercules_domain_agent_identities is
  'Managed tenant-facing Domain Agent identities. Contains routing metadata only, never provider credentials.';

insert into private.hercules_domain_agent_identities(
  organization_id,hostname,hosting_provider,target_host,hosting_alias_status,
  dns_provider,dns_status,ssl_status,white_label,metadata
)
select
  id,
  'agent.sauceapproved.com',
  'netlify',
  'hercules-sauceapproved.netlify.app',
  'pending',
  'spaceship',
  'pending_authorization',
  'pending',
  true,
  jsonb_build_object(
    'backend_endpoint','https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge',
    'dns_record',jsonb_build_object(
      'type','CNAME',
      'name','agent',
      'value','hercules-sauceapproved.netlify.app',
      'ttl',3600
    ),
    'netlify_site_id','6bbb52f4-ee2d-440a-a201-c6a12057f4bf',
    'owner_boundary','dns_provider_authorization'
  )
from public.hercules_organizations
where slug='sauceapproved'
on conflict (hostname) do update set
  organization_id=excluded.organization_id,
  hosting_provider=excluded.hosting_provider,
  target_host=excluded.target_host,
  dns_provider=excluded.dns_provider,
  white_label=excluded.white_label,
  metadata=excluded.metadata,
  updated_at=now();

update public.hercules_plans
set
  limits = limits || jsonb_build_object(
    'domain_agent_executions_month',
    case code
      when 'starter' then 500
      when 'pro' then 5000
      when 'scale' then 50000
      else 0
    end,
    'domain_agent_custom_identities',
    case code
      when 'starter' then 1
      when 'pro' then 10
      when 'scale' then 100
      else 0
    end
  ),
  features = features || jsonb_build_object(
    'domain_agent', true,
    'domain_agent_api', true,
    'domain_agent_custom_identity', true,
    'domain_agent_provider_refresh', true,
    'domain_agent_white_label', code='scale'
  ),
  updated_at = now()
where code in ('starter','pro','scale');

update public.hercules_organizations
set
  metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'founder_control_plane', true,
    'domain_agent_internal_entitlement', true
  ),
  updated_at = now()
where slug='sauceapproved';

create or replace function public.hercules_domain_agent_entitlement(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org record;
  v_sub record;
  v_plan record;
  v_founder boolean := false;
  v_active boolean := false;
  v_limit integer := 0;
begin
  select id,status,metadata
  into v_org
  from public.hercules_organizations
  where id=p_organization_id
  limit 1;

  if not found or v_org.status<>'active' then
    return jsonb_build_object(
      'enabled',false,
      'reason','organization_not_active',
      'organization_id',p_organization_id
    );
  end if;

  v_founder := lower(coalesce(v_org.metadata->>'founder_control_plane','false'))='true';
  if v_founder then
    return jsonb_build_object(
      'enabled',true,
      'founder_internal',true,
      'organization_id',p_organization_id,
      'plan_code','founder-internal',
      'monthly_execution_limit',null,
      'features',jsonb_build_object(
        'domain_agent',true,
        'domain_agent_api',true,
        'domain_agent_custom_identity',true,
        'domain_agent_provider_refresh',true,
        'domain_agent_white_label',true
      )
    );
  end if;

  select s.plan_code,s.status,s.current_period_start,s.current_period_end,s.trial_ends_at
  into v_sub
  from public.hercules_subscriptions s
  where s.organization_id=p_organization_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'enabled',false,
      'reason','subscription_required',
      'organization_id',p_organization_id
    );
  end if;

  v_active :=
    v_sub.status='active'
    or (
      v_sub.status='trialing'
      and (v_sub.trial_ends_at is null or v_sub.trial_ends_at>now())
    );

  if not v_active then
    return jsonb_build_object(
      'enabled',false,
      'reason','subscription_inactive',
      'organization_id',p_organization_id,
      'plan_code',v_sub.plan_code,
      'subscription_status',v_sub.status
    );
  end if;

  select code,limits,features,is_active
  into v_plan
  from public.hercules_plans
  where code=v_sub.plan_code
  limit 1;

  if not found
     or v_plan.is_active is not true
     or coalesce((v_plan.features->>'domain_agent')::boolean,false) is not true then
    return jsonb_build_object(
      'enabled',false,
      'reason','domain_agent_not_in_plan',
      'organization_id',p_organization_id,
      'plan_code',v_sub.plan_code
    );
  end if;

  v_limit := greatest(0,coalesce((v_plan.limits->>'domain_agent_executions_month')::integer,0));

  return jsonb_build_object(
    'enabled',true,
    'founder_internal',false,
    'organization_id',p_organization_id,
    'plan_code',v_plan.code,
    'monthly_execution_limit',v_limit,
    'features',v_plan.features
  );
end;
$$;

revoke all on function public.hercules_domain_agent_entitlement(uuid)
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_entitlement(uuid)
  to service_role;

create or replace function public.hercules_domain_agent_identity_status(
  p_organization_id uuid
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'schema','hercules.domain-agent.identities.v1',
    'organization_id',p_organization_id,
    'identities',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',i.id,
          'hostname',i.hostname,
          'hosting_provider',i.hosting_provider,
          'target_host',i.target_host,
          'hosting_alias_status',i.hosting_alias_status,
          'dns_provider',i.dns_provider,
          'dns_status',i.dns_status,
          'ssl_status',i.ssl_status,
          'white_label',i.white_label,
          'verified_at',i.verified_at,
          'metadata',i.metadata,
          'updated_at',i.updated_at
        )
        order by i.hostname
      ) filter (where i.id is not null),
      '[]'::jsonb
    )
  )
  from private.hercules_domain_agent_identities i
  where i.organization_id=p_organization_id
$$;

revoke all on function public.hercules_domain_agent_identity_status(uuid)
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_identity_status(uuid)
  to service_role;

create or replace function public.hercules_domain_agent_usage_status(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_entitlement jsonb;
  v_period date := date_trunc('month',now())::date;
  v_used integer := 0;
begin
  v_entitlement := public.hercules_domain_agent_entitlement(p_organization_id);

  select coalesce(sum(quantity),0)::integer
  into v_used
  from private.hercules_domain_agent_usage
  where organization_id=p_organization_id
    and metric='execution'
    and period_start=v_period;

  return jsonb_build_object(
    'schema','hercules.domain-agent.usage.v1',
    'organization_id',p_organization_id,
    'period_start',v_period,
    'executions_used',v_used,
    'execution_limit',v_entitlement->'monthly_execution_limit',
    'enabled',coalesce((v_entitlement->>'enabled')::boolean,false),
    'founder_internal',coalesce((v_entitlement->>'founder_internal')::boolean,false),
    'plan_code',v_entitlement->>'plan_code',
    'features',coalesce(v_entitlement->'features','{}'::jsonb)
  );
end;
$$;

revoke all on function public.hercules_domain_agent_usage_status(uuid)
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_usage_status(uuid)
  to service_role;

create or replace function public.hercules_domain_agent_record_usage(
  p_organization_id uuid,
  p_request_id text,
  p_metric text default 'execution',
  p_quantity integer default 1,
  p_source text default 'hercules-internal',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_entitlement jsonb;
  v_period date := date_trunc('month',now())::date;
  v_limit integer;
  v_used integer := 0;
  v_existing integer := 0;
begin
  if p_request_id is null or char_length(btrim(p_request_id)) not between 1 and 128 then
    raise exception 'invalid_request_id';
  end if;
  if p_metric<>'execution' then raise exception 'unsupported_usage_metric'; end if;
  if p_quantity<1 or p_quantity>1000 then raise exception 'invalid_usage_quantity'; end if;
  if p_source not in ('owner-admin','hercules-internal','api-key') then
    raise exception 'invalid_usage_source';
  end if;

  v_entitlement := public.hercules_domain_agent_entitlement(p_organization_id);
  if coalesce((v_entitlement->>'enabled')::boolean,false) is not true then
    raise exception 'domain_agent_entitlement_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||v_period::text,0));

  select quantity
  into v_existing
  from private.hercules_domain_agent_usage
  where organization_id=p_organization_id
    and request_id=btrim(p_request_id)
    and metric=p_metric
  limit 1;

  if found then
    return public.hercules_domain_agent_usage_status(p_organization_id)
      || jsonb_build_object('duplicate',true,'recorded_quantity',v_existing);
  end if;

  select coalesce(sum(quantity),0)::integer
  into v_used
  from private.hercules_domain_agent_usage
  where organization_id=p_organization_id
    and metric=p_metric
    and period_start=v_period;

  if (v_entitlement->>'monthly_execution_limit') is not null then
    v_limit := (v_entitlement->>'monthly_execution_limit')::integer;
    if v_used+p_quantity>v_limit then
      raise exception 'domain_agent_usage_limit_exceeded';
    end if;
  end if;

  insert into private.hercules_domain_agent_usage(
    organization_id,request_id,metric,quantity,period_start,source,metadata
  ) values (
    p_organization_id,btrim(p_request_id),p_metric,p_quantity,v_period,p_source,coalesce(p_metadata,'{}'::jsonb)
  );

  return public.hercules_domain_agent_usage_status(p_organization_id)
    || jsonb_build_object('duplicate',false,'recorded_quantity',p_quantity);
end;
$$;

revoke all on function public.hercules_domain_agent_record_usage(uuid,text,text,integer,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_record_usage(uuid,text,text,integer,text,jsonb)
  to service_role;

create or replace function public.hercules_domain_agent_record_audit(
  p_organization_id uuid,
  p_request_id text,
  p_principal_type text,
  p_action text,
  p_provider text,
  p_account_key text,
  p_disposition text,
  p_decision_sha256 text,
  p_authorization_evidence_sha256 text default null,
  p_required_capabilities text[] default '{}'::text[],
  p_missing_capabilities text[] default '{}'::text[],
  p_reason_codes text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if p_organization_id is null then raise exception 'organization_id_required'; end if;
  if p_request_id is null or char_length(btrim(p_request_id)) not between 1 and 128 then
    raise exception 'invalid_request_id';
  end if;
  if p_principal_type not in ('owner-admin','hercules-internal','api-key') then
    raise exception 'invalid_principal_type';
  end if;
  if p_action not in ('task_preflight','grant_status','execute','execution_status','usage_status') then
    raise exception 'invalid_audit_action';
  end if;
  if p_decision_sha256 is null or p_decision_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_decision_sha256';
  end if;
  if p_authorization_evidence_sha256 is not null
     and p_authorization_evidence_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_authorization_evidence_sha256';
  end if;

  insert into private.hercules_domain_agent_audit(
    organization_id,request_id,principal_type,action,provider,account_key,
    disposition,decision_sha256,authorization_evidence_sha256,
    required_capabilities,missing_capabilities,reason_codes
  ) values (
    p_organization_id,btrim(p_request_id),p_principal_type,p_action,
    nullif(btrim(coalesce(p_provider,'')),''),
    nullif(btrim(coalesce(p_account_key,'')),''),
    btrim(p_disposition),p_decision_sha256,p_authorization_evidence_sha256,
    coalesce(p_required_capabilities,'{}'::text[]),
    coalesce(p_missing_capabilities,'{}'::text[]),
    coalesce(p_reason_codes,'{}'::text[])
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.hercules_domain_agent_record_audit(
  uuid,text,text,text,text,text,text,text,text,text[],text[],text[]
) from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_record_audit(
  uuid,text,text,text,text,text,text,text,text,text[],text[],text[]
) to service_role;
