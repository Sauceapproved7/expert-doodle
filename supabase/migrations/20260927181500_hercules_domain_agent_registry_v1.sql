create table if not exists private.hercules_domain_agent_provider_policies (
  provider text primary key check (provider ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  credential_mode text not null check (credential_mode in ('access_vault_ref','any_vault_ref','metadata_authorized')),
  refresh_mode text not null check (refresh_mode in ('none','client_credentials','oauth_refresh','app_installation')),
  default_capabilities text[] not null default '{}'::text[],
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table private.hercules_domain_agent_provider_policies enable row level security;
revoke all on table private.hercules_domain_agent_provider_policies from public, anon, authenticated;

comment on table private.hercules_domain_agent_provider_policies is
  'Credential-free provider capability policy for Hercules Domain Agent. Actual provider secrets remain in Supabase Vault.';


create table if not exists private.hercules_domain_agent_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.hercules_organizations(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 1 and 128),
  principal_type text not null check (principal_type in ('owner-admin','hercules-internal')),
  action text not null check (action in ('task_preflight','grant_status')),
  provider text,
  account_key text,
  disposition text not null,
  decision_sha256 text not null check (decision_sha256 ~ '^[0-9a-f]{64}
insert into private.hercules_domain_agent_provider_policies(
  provider,credential_mode,refresh_mode,default_capabilities,enabled,metadata
) values
  (
    'google_drive','any_vault_ref','oauth_refresh',
    array['knowledge.read']::text[],true,
    '{"authorization_model":"oauth-pkce","least_privilege":"drive.readonly"}'::jsonb
  ),
  (
    'github_forge','any_vault_ref','app_installation',
    array['github.bridge.verify']::text[],true,
    '{"authorization_model":"github-app","main_branch_direct_write":false}'::jsonb
  ),
  (
    'shopify','access_vault_ref','client_credentials',
    array['shopify.domain.observe','shopify.launch.read']::text[],true,
    '{"authorization_model":"client-credentials","store_locked":true}'::jsonb
  ),
  (
    'stripe','access_vault_ref','none',
    array['stripe.account.read','stripe.catalog.manage','stripe.webhook.manage']::text[],true,
    '{"authorization_model":"api-key","automatic_refresh":false}'::jsonb
  )
on conflict (provider) do update set
  credential_mode=excluded.credential_mode,
  refresh_mode=excluded.refresh_mode,
  default_capabilities=excluded.default_capabilities,
  enabled=excluded.enabled,
  metadata=excluded.metadata,
  updated_at=now();

do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='domain-agent-control'
  ) then
    v_internal_key := encode(extensions.gen_random_bytes(32),'hex');
    v_secret_ref := public.hercules_store_secret(
      v_internal_key,
      'hercules-domain-agent-control-internal',
      'Internal authentication key for Hercules Domain Agent service-to-service requests.'
    );

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'domain-agent-control',
      encode(extensions.digest(v_internal_key,'sha256'),'hex'),
      true,
      now(),
      '{"scope":"domain-agent-control","owner":"Hercules","credentialType":"internal-control"}'::jsonb,
      v_secret_ref
    );

    v_internal_key := null;
  end if;
end
$$;

create or replace function public.hercules_domain_agent_resolve_provider_grant(
  p_organization_id uuid,
  p_provider text,
  p_account_key text default null,
  p_required_capabilities text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_policy record;
  v_conn record;
  v_capabilities text[] := '{}'::text[];
  v_explicit_capabilities text[] := '{}'::text[];
  v_required text[] := '{}'::text[];
  v_missing text[] := '{}'::text[];
  v_has_credential_evidence boolean := false;
  v_authorized boolean := false;
  v_evidence text;
  v_status text;
begin
  if p_organization_id is null then
    raise exception 'organization_id_required';
  end if;
  if p_provider is null or btrim(p_provider)='' then
    raise exception 'provider_required';
  end if;

  select provider,credential_mode,refresh_mode,default_capabilities,enabled,metadata
  into v_policy
  from private.hercules_domain_agent_provider_policies
  where provider=lower(btrim(p_provider))
  limit 1;

  if not found or not v_policy.enabled then
    return jsonb_build_object(
      'schema','hercules.domain-agent.provider-grant-resolution.v1',
      'status','unsupported_provider',
      'provider',lower(btrim(p_provider)),
      'organization_id',p_organization_id,
      'execution_eligible',false,
      'owner_action_required',false,
      'carries_credentials',false,
      'credential_custody','supabase_vault',
      'reason_codes',jsonb_build_array('PROVIDER_NOT_ENABLED')
    );
  end if;

  select
    p.id,p.organization_id,p.provider,p.account_key,p.status,p.connected_at,p.updated_at,p.metadata,
    p.access_secret_ref is not null as has_access_secret,
    p.secret_ref is not null as has_client_secret,
    p.signing_secret_ref is not null as has_signing_secret
  into v_conn
  from public.hercules_provider_connections p
  where p.organization_id=p_organization_id
    and p.provider=v_policy.provider
    and (p_account_key is null or p.account_key=p_account_key)
  order by (p.status='active') desc,p.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'schema','hercules.domain-agent.provider-grant-resolution.v1',
      'status','provider_connection_required',
      'provider',v_policy.provider,
      'organization_id',p_organization_id,
      'execution_eligible',false,
      'owner_action_required',true,
      'carries_credentials',false,
      'credential_custody','supabase_vault',
      'reason_codes',jsonb_build_array('PROVIDER_CONNECTION_REQUIRED')
    );
  end if;

  select coalesce(array_agg(value order by value),'{}'::text[])
  into v_explicit_capabilities
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(coalesce(v_conn.metadata,'{}'::jsonb)->'agent_capabilities')='array'
        then coalesce(v_conn.metadata,'{}'::jsonb)->'agent_capabilities'
      else '[]'::jsonb
    end
  ) as e(value);

  v_capabilities := coalesce(v_policy.default_capabilities,'{}'::text[]) || coalesce(v_explicit_capabilities,'{}'::text[]);

  if v_policy.provider='github_forge'
     and lower(coalesce(v_conn.metadata->>'write_verified','false'))='true' then
    v_capabilities := v_capabilities || array['github.repo.write']::text[];
  end if;

  select coalesce(array_agg(distinct c order by c),'{}'::text[])
  into v_capabilities
  from unnest(v_capabilities) as x(c)
  where c is not null and btrim(c)<>'';

  select coalesce(array_agg(distinct lower(btrim(c)) order by lower(btrim(c))),'{}'::text[])
  into v_required
  from unnest(coalesce(p_required_capabilities,'{}'::text[])) as x(c)
  where c is not null and btrim(c)<>'';

  select coalesce(array_agg(c order by c),'{}'::text[])
  into v_missing
  from unnest(v_required) as x(c)
  where not (c=any(v_capabilities));

  v_has_credential_evidence := case v_policy.credential_mode
    when 'access_vault_ref' then v_conn.has_access_secret
    when 'any_vault_ref' then
      v_conn.has_access_secret or v_conn.has_client_secret or v_conn.has_signing_secret
    when 'metadata_authorized' then
      lower(coalesce(v_conn.metadata->>'authorized','false'))='true'
    else false
  end;

  v_authorized :=
    v_conn.status='active'
    and v_conn.connected_at is not null
    and v_has_credential_evidence;

  v_evidence := encode(
    extensions.digest(
      concat_ws('|',
        v_conn.id::text,
        v_conn.organization_id::text,
        v_conn.provider,
        v_conn.account_key,
        v_conn.status,
        coalesce(v_conn.connected_at::text,''),
        coalesce(v_conn.updated_at::text,''),
        v_conn.has_access_secret::text,
        v_conn.has_client_secret::text,
        v_conn.has_signing_secret::text,
        array_to_string(v_capabilities,',')
      ),
      'sha256'
    ),
    'hex'
  );

  if not v_authorized then
    v_status := 'provider_connection_required';
  elsif cardinality(v_missing)>0 then
    v_status := 'provider_permission_required';
  else
    v_status := 'ready';
  end if;

  return jsonb_build_object(
    'schema','hercules.domain-agent.provider-grant-resolution.v1',
    'status',v_status,
    'organization_id',v_conn.organization_id,
    'provider',v_conn.provider,
    'account_key',v_conn.account_key,
    'connection_ref',v_conn.id,
    'authorization_evidence_sha256',v_evidence,
    'authorized_at',v_conn.connected_at,
    'last_observed_at',v_conn.updated_at,
    'capabilities',to_jsonb(v_capabilities),
    'required_capabilities',to_jsonb(v_required),
    'missing_capabilities',to_jsonb(v_missing),
    'refreshable',(v_policy.refresh_mode<>'none' and v_authorized),
    'refresh_mode',v_policy.refresh_mode,
    'execution_eligible',(v_authorized and cardinality(v_missing)=0),
    'owner_action_required',(not v_authorized or cardinality(v_missing)>0),
    'carries_credentials',false,
    'credential_custody','supabase_vault',
    'reason_codes',
      case
        when not v_authorized then jsonb_build_array('PROVIDER_CONNECTION_REQUIRED')
        when cardinality(v_missing)>0 then jsonb_build_array('PROVIDER_SCOPE_GRANT_REQUIRED')
        else jsonb_build_array('AUTHORIZED_PROVIDER_GRANT')
      end
  );
end;
$$;

revoke all on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[])
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[])
  to service_role;

comment on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[]) is
  'Returns sanitized, credential-free authorization evidence for Hercules Domain Agent. Never decrypts Vault values.';
),
  authorization_evidence_sha256 text check (
    authorization_evidence_sha256 is null or authorization_evidence_sha256 ~ '^[0-9a-f]{64}
insert into private.hercules_domain_agent_provider_policies(
  provider,credential_mode,refresh_mode,default_capabilities,enabled,metadata
) values
  (
    'google_drive','any_vault_ref','oauth_refresh',
    array['knowledge.read']::text[],true,
    '{"authorization_model":"oauth-pkce","least_privilege":"drive.readonly"}'::jsonb
  ),
  (
    'github_forge','any_vault_ref','app_installation',
    array['github.bridge.verify']::text[],true,
    '{"authorization_model":"github-app","main_branch_direct_write":false}'::jsonb
  ),
  (
    'shopify','access_vault_ref','client_credentials',
    array['shopify.domain.observe','shopify.launch.read']::text[],true,
    '{"authorization_model":"client-credentials","store_locked":true}'::jsonb
  ),
  (
    'stripe','access_vault_ref','none',
    array['stripe.account.read','stripe.catalog.manage','stripe.webhook.manage']::text[],true,
    '{"authorization_model":"api-key","automatic_refresh":false}'::jsonb
  )
on conflict (provider) do update set
  credential_mode=excluded.credential_mode,
  refresh_mode=excluded.refresh_mode,
  default_capabilities=excluded.default_capabilities,
  enabled=excluded.enabled,
  metadata=excluded.metadata,
  updated_at=now();

do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='domain-agent-control'
  ) then
    v_internal_key := encode(extensions.gen_random_bytes(32),'hex');
    v_secret_ref := public.hercules_store_secret(
      v_internal_key,
      'hercules-domain-agent-control-internal',
      'Internal authentication key for Hercules Domain Agent service-to-service requests.'
    );

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'domain-agent-control',
      encode(extensions.digest(v_internal_key,'sha256'),'hex'),
      true,
      now(),
      '{"scope":"domain-agent-control","owner":"Hercules","credentialType":"internal-control"}'::jsonb,
      v_secret_ref
    );

    v_internal_key := null;
  end if;
end
$$;

create or replace function public.hercules_domain_agent_resolve_provider_grant(
  p_organization_id uuid,
  p_provider text,
  p_account_key text default null,
  p_required_capabilities text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_policy record;
  v_conn record;
  v_capabilities text[] := '{}'::text[];
  v_explicit_capabilities text[] := '{}'::text[];
  v_required text[] := '{}'::text[];
  v_missing text[] := '{}'::text[];
  v_has_credential_evidence boolean := false;
  v_authorized boolean := false;
  v_evidence text;
  v_status text;
begin
  if p_organization_id is null then
    raise exception 'organization_id_required';
  end if;
  if p_provider is null or btrim(p_provider)='' then
    raise exception 'provider_required';
  end if;

  select provider,credential_mode,refresh_mode,default_capabilities,enabled,metadata
  into v_policy
  from private.hercules_domain_agent_provider_policies
  where provider=lower(btrim(p_provider))
  limit 1;

  if not found or not v_policy.enabled then
    return jsonb_build_object(
      'schema','hercules.domain-agent.provider-grant-resolution.v1',
      'status','unsupported_provider',
      'provider',lower(btrim(p_provider)),
      'organization_id',p_organization_id,
      'execution_eligible',false,
      'owner_action_required',false,
      'carries_credentials',false,
      'credential_custody','supabase_vault',
      'reason_codes',jsonb_build_array('PROVIDER_NOT_ENABLED')
    );
  end if;

  select
    p.id,p.organization_id,p.provider,p.account_key,p.status,p.connected_at,p.updated_at,p.metadata,
    p.access_secret_ref is not null as has_access_secret,
    p.secret_ref is not null as has_client_secret,
    p.signing_secret_ref is not null as has_signing_secret
  into v_conn
  from public.hercules_provider_connections p
  where p.organization_id=p_organization_id
    and p.provider=v_policy.provider
    and (p_account_key is null or p.account_key=p_account_key)
  order by (p.status='active') desc,p.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'schema','hercules.domain-agent.provider-grant-resolution.v1',
      'status','provider_connection_required',
      'provider',v_policy.provider,
      'organization_id',p_organization_id,
      'execution_eligible',false,
      'owner_action_required',true,
      'carries_credentials',false,
      'credential_custody','supabase_vault',
      'reason_codes',jsonb_build_array('PROVIDER_CONNECTION_REQUIRED')
    );
  end if;

  select coalesce(array_agg(value order by value),'{}'::text[])
  into v_explicit_capabilities
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(coalesce(v_conn.metadata,'{}'::jsonb)->'agent_capabilities')='array'
        then coalesce(v_conn.metadata,'{}'::jsonb)->'agent_capabilities'
      else '[]'::jsonb
    end
  ) as e(value);

  v_capabilities := coalesce(v_policy.default_capabilities,'{}'::text[]) || coalesce(v_explicit_capabilities,'{}'::text[]);

  if v_policy.provider='github_forge'
     and lower(coalesce(v_conn.metadata->>'write_verified','false'))='true' then
    v_capabilities := v_capabilities || array['github.repo.write']::text[];
  end if;

  select coalesce(array_agg(distinct c order by c),'{}'::text[])
  into v_capabilities
  from unnest(v_capabilities) as x(c)
  where c is not null and btrim(c)<>'';

  select coalesce(array_agg(distinct lower(btrim(c)) order by lower(btrim(c))),'{}'::text[])
  into v_required
  from unnest(coalesce(p_required_capabilities,'{}'::text[])) as x(c)
  where c is not null and btrim(c)<>'';

  select coalesce(array_agg(c order by c),'{}'::text[])
  into v_missing
  from unnest(v_required) as x(c)
  where not (c=any(v_capabilities));

  v_has_credential_evidence := case v_policy.credential_mode
    when 'access_vault_ref' then v_conn.has_access_secret
    when 'any_vault_ref' then
      v_conn.has_access_secret or v_conn.has_client_secret or v_conn.has_signing_secret
    when 'metadata_authorized' then
      lower(coalesce(v_conn.metadata->>'authorized','false'))='true'
    else false
  end;

  v_authorized :=
    v_conn.status='active'
    and v_conn.connected_at is not null
    and v_has_credential_evidence;

  v_evidence := encode(
    extensions.digest(
      concat_ws('|',
        v_conn.id::text,
        v_conn.organization_id::text,
        v_conn.provider,
        v_conn.account_key,
        v_conn.status,
        coalesce(v_conn.connected_at::text,''),
        coalesce(v_conn.updated_at::text,''),
        v_conn.has_access_secret::text,
        v_conn.has_client_secret::text,
        v_conn.has_signing_secret::text,
        array_to_string(v_capabilities,',')
      ),
      'sha256'
    ),
    'hex'
  );

  if not v_authorized then
    v_status := 'provider_connection_required';
  elsif cardinality(v_missing)>0 then
    v_status := 'provider_permission_required';
  else
    v_status := 'ready';
  end if;

  return jsonb_build_object(
    'schema','hercules.domain-agent.provider-grant-resolution.v1',
    'status',v_status,
    'organization_id',v_conn.organization_id,
    'provider',v_conn.provider,
    'account_key',v_conn.account_key,
    'connection_ref',v_conn.id,
    'authorization_evidence_sha256',v_evidence,
    'authorized_at',v_conn.connected_at,
    'last_observed_at',v_conn.updated_at,
    'capabilities',to_jsonb(v_capabilities),
    'required_capabilities',to_jsonb(v_required),
    'missing_capabilities',to_jsonb(v_missing),
    'refreshable',(v_policy.refresh_mode<>'none' and v_authorized),
    'refresh_mode',v_policy.refresh_mode,
    'execution_eligible',(v_authorized and cardinality(v_missing)=0),
    'owner_action_required',(not v_authorized or cardinality(v_missing)>0),
    'carries_credentials',false,
    'credential_custody','supabase_vault',
    'reason_codes',
      case
        when not v_authorized then jsonb_build_array('PROVIDER_CONNECTION_REQUIRED')
        when cardinality(v_missing)>0 then jsonb_build_array('PROVIDER_SCOPE_GRANT_REQUIRED')
        else jsonb_build_array('AUTHORIZED_PROVIDER_GRANT')
      end
  );
end;
$$;

revoke all on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[])
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[])
  to service_role;

comment on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[]) is
  'Returns sanitized, credential-free authorization evidence for Hercules Domain Agent. Never decrypts Vault values.';

  ),
  required_capabilities text[] not null default '{}'::text[],
  missing_capabilities text[] not null default '{}'::text[],
  reason_codes text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table private.hercules_domain_agent_audit enable row level security;
revoke all on table private.hercules_domain_agent_audit from public, anon, authenticated;

create index if not exists hercules_domain_agent_audit_org_created_idx
  on private.hercules_domain_agent_audit(organization_id,created_at desc);

comment on table private.hercules_domain_agent_audit is
  'Sanitized Hercules Domain Agent authorization decisions. Stores no provider credentials, raw task input, cookies, MFA values, or CAPTCHA material.';

insert into private.hercules_domain_agent_provider_policies(
  provider,credential_mode,refresh_mode,default_capabilities,enabled,metadata
) values
  (
    'google_drive','any_vault_ref','oauth_refresh',
    array['knowledge.read']::text[],true,
    '{"authorization_model":"oauth-pkce","least_privilege":"drive.readonly"}'::jsonb
  ),
  (
    'github_forge','any_vault_ref','app_installation',
    array['github.bridge.verify']::text[],true,
    '{"authorization_model":"github-app","main_branch_direct_write":false}'::jsonb
  ),
  (
    'shopify','access_vault_ref','client_credentials',
    array['shopify.domain.observe','shopify.launch.read']::text[],true,
    '{"authorization_model":"client-credentials","store_locked":true}'::jsonb
  ),
  (
    'stripe','access_vault_ref','none',
    array['stripe.account.read','stripe.catalog.manage','stripe.webhook.manage']::text[],true,
    '{"authorization_model":"api-key","automatic_refresh":false}'::jsonb
  )
on conflict (provider) do update set
  credential_mode=excluded.credential_mode,
  refresh_mode=excluded.refresh_mode,
  default_capabilities=excluded.default_capabilities,
  enabled=excluded.enabled,
  metadata=excluded.metadata,
  updated_at=now();

do $$
declare
  v_internal_key text;
  v_secret_ref uuid;
begin
  if not exists (
    select 1 from public.hercules_internal_service_keys
    where purpose='domain-agent-control'
  ) then
    v_internal_key := encode(extensions.gen_random_bytes(32),'hex');
    v_secret_ref := public.hercules_store_secret(
      v_internal_key,
      'hercules-domain-agent-control-internal',
      'Internal authentication key for Hercules Domain Agent service-to-service requests.'
    );

    insert into public.hercules_internal_service_keys(
      purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
    ) values (
      'domain-agent-control',
      encode(extensions.digest(v_internal_key,'sha256'),'hex'),
      true,
      now(),
      '{"scope":"domain-agent-control","owner":"Hercules","credentialType":"internal-control"}'::jsonb,
      v_secret_ref
    );

    v_internal_key := null;
  end if;
end
$$;

create or replace function public.hercules_domain_agent_resolve_provider_grant(
  p_organization_id uuid,
  p_provider text,
  p_account_key text default null,
  p_required_capabilities text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_policy record;
  v_conn record;
  v_capabilities text[] := '{}'::text[];
  v_explicit_capabilities text[] := '{}'::text[];
  v_required text[] := '{}'::text[];
  v_missing text[] := '{}'::text[];
  v_has_credential_evidence boolean := false;
  v_authorized boolean := false;
  v_evidence text;
  v_status text;
begin
  if p_organization_id is null then
    raise exception 'organization_id_required';
  end if;
  if p_provider is null or btrim(p_provider)='' then
    raise exception 'provider_required';
  end if;

  select provider,credential_mode,refresh_mode,default_capabilities,enabled,metadata
  into v_policy
  from private.hercules_domain_agent_provider_policies
  where provider=lower(btrim(p_provider))
  limit 1;

  if not found or not v_policy.enabled then
    return jsonb_build_object(
      'schema','hercules.domain-agent.provider-grant-resolution.v1',
      'status','unsupported_provider',
      'provider',lower(btrim(p_provider)),
      'organization_id',p_organization_id,
      'execution_eligible',false,
      'owner_action_required',false,
      'carries_credentials',false,
      'credential_custody','supabase_vault',
      'reason_codes',jsonb_build_array('PROVIDER_NOT_ENABLED')
    );
  end if;

  select
    p.id,p.organization_id,p.provider,p.account_key,p.status,p.connected_at,p.updated_at,p.metadata,
    p.access_secret_ref is not null as has_access_secret,
    p.secret_ref is not null as has_client_secret,
    p.signing_secret_ref is not null as has_signing_secret
  into v_conn
  from public.hercules_provider_connections p
  where p.organization_id=p_organization_id
    and p.provider=v_policy.provider
    and (p_account_key is null or p.account_key=p_account_key)
  order by (p.status='active') desc,p.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'schema','hercules.domain-agent.provider-grant-resolution.v1',
      'status','provider_connection_required',
      'provider',v_policy.provider,
      'organization_id',p_organization_id,
      'execution_eligible',false,
      'owner_action_required',true,
      'carries_credentials',false,
      'credential_custody','supabase_vault',
      'reason_codes',jsonb_build_array('PROVIDER_CONNECTION_REQUIRED')
    );
  end if;

  select coalesce(array_agg(value order by value),'{}'::text[])
  into v_explicit_capabilities
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(coalesce(v_conn.metadata,'{}'::jsonb)->'agent_capabilities')='array'
        then coalesce(v_conn.metadata,'{}'::jsonb)->'agent_capabilities'
      else '[]'::jsonb
    end
  ) as e(value);

  v_capabilities := coalesce(v_policy.default_capabilities,'{}'::text[]) || coalesce(v_explicit_capabilities,'{}'::text[]);

  if v_policy.provider='github_forge'
     and lower(coalesce(v_conn.metadata->>'write_verified','false'))='true' then
    v_capabilities := v_capabilities || array['github.repo.write']::text[];
  end if;

  select coalesce(array_agg(distinct c order by c),'{}'::text[])
  into v_capabilities
  from unnest(v_capabilities) as x(c)
  where c is not null and btrim(c)<>'';

  select coalesce(array_agg(distinct lower(btrim(c)) order by lower(btrim(c))),'{}'::text[])
  into v_required
  from unnest(coalesce(p_required_capabilities,'{}'::text[])) as x(c)
  where c is not null and btrim(c)<>'';

  select coalesce(array_agg(c order by c),'{}'::text[])
  into v_missing
  from unnest(v_required) as x(c)
  where not (c=any(v_capabilities));

  v_has_credential_evidence := case v_policy.credential_mode
    when 'access_vault_ref' then v_conn.has_access_secret
    when 'any_vault_ref' then
      v_conn.has_access_secret or v_conn.has_client_secret or v_conn.has_signing_secret
    when 'metadata_authorized' then
      lower(coalesce(v_conn.metadata->>'authorized','false'))='true'
    else false
  end;

  v_authorized :=
    v_conn.status='active'
    and v_conn.connected_at is not null
    and v_has_credential_evidence;

  v_evidence := encode(
    extensions.digest(
      concat_ws('|',
        v_conn.id::text,
        v_conn.organization_id::text,
        v_conn.provider,
        v_conn.account_key,
        v_conn.status,
        coalesce(v_conn.connected_at::text,''),
        coalesce(v_conn.updated_at::text,''),
        v_conn.has_access_secret::text,
        v_conn.has_client_secret::text,
        v_conn.has_signing_secret::text,
        array_to_string(v_capabilities,',')
      ),
      'sha256'
    ),
    'hex'
  );

  if not v_authorized then
    v_status := 'provider_connection_required';
  elsif cardinality(v_missing)>0 then
    v_status := 'provider_permission_required';
  else
    v_status := 'ready';
  end if;

  return jsonb_build_object(
    'schema','hercules.domain-agent.provider-grant-resolution.v1',
    'status',v_status,
    'organization_id',v_conn.organization_id,
    'provider',v_conn.provider,
    'account_key',v_conn.account_key,
    'connection_ref',v_conn.id,
    'authorization_evidence_sha256',v_evidence,
    'authorized_at',v_conn.connected_at,
    'last_observed_at',v_conn.updated_at,
    'capabilities',to_jsonb(v_capabilities),
    'required_capabilities',to_jsonb(v_required),
    'missing_capabilities',to_jsonb(v_missing),
    'refreshable',(v_policy.refresh_mode<>'none' and v_authorized),
    'refresh_mode',v_policy.refresh_mode,
    'execution_eligible',(v_authorized and cardinality(v_missing)=0),
    'owner_action_required',(not v_authorized or cardinality(v_missing)>0),
    'carries_credentials',false,
    'credential_custody','supabase_vault',
    'reason_codes',
      case
        when not v_authorized then jsonb_build_array('PROVIDER_CONNECTION_REQUIRED')
        when cardinality(v_missing)>0 then jsonb_build_array('PROVIDER_SCOPE_GRANT_REQUIRED')
        else jsonb_build_array('AUTHORIZED_PROVIDER_GRANT')
      end
  );
end;
$$;

revoke all on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[])
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[])
  to service_role;

comment on function public.hercules_domain_agent_resolve_provider_grant(uuid,text,text,text[]) is
  'Returns sanitized, credential-free authorization evidence for Hercules Domain Agent. Never decrypts Vault values.';
