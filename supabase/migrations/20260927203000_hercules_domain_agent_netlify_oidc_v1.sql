create or replace function public.hercules_domain_agent_stage_netlify_deploy_proxy(
  p_proxy_path text,
  p_expires_at timestamptz,
  p_site_id text default '6bbb52f4-ee2d-440a-a201-c6a12057f4bf'
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_secret_ref uuid;
  v_proxy text := btrim(coalesce(p_proxy_path,''));
begin
  if v_proxy !~ '^https://netlify-mcp\.netlify\.app/proxy/[A-Za-z0-9._~-]+$' then
    raise exception 'invalid_netlify_deploy_proxy';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now()+interval '2 hours' then
    raise exception 'invalid_netlify_deploy_proxy_expiry';
  end if;
  if p_site_id <> '6bbb52f4-ee2d-440a-a201-c6a12057f4bf' then
    raise exception 'unexpected_netlify_site';
  end if;

  v_secret_ref := public.hercules_store_secret(
    v_proxy,
    'hercules-netlify-domain-agent-deploy-'||extract(epoch from clock_timestamp())::bigint,
    'One-time Netlify MCP proxy for Hercules Domain Agent front-door deployment.'
  );

  insert into public.hercules_internal_service_keys(
    purpose,key_sha256,enabled,rotated_at,metadata,secret_ref
  ) values (
    'netlify-domain-agent-deploy-proxy',
    encode(extensions.digest(v_proxy,'sha256'),'hex'),
    true,
    now(),
    jsonb_build_object(
      'site_id',p_site_id,
      'expires_at',p_expires_at,
      'repository','Sauceapproved7/expert-doodle',
      'ref','refs/heads/main',
      'audience','hercules-netlify-deploy',
      'workflow','Hercules Domain Agent Netlify Deploy',
      'one_time',true
    ),
    v_secret_ref
  )
  on conflict (purpose) do update set
    key_sha256=excluded.key_sha256,
    enabled=true,
    rotated_at=now(),
    metadata=excluded.metadata,
    secret_ref=excluded.secret_ref;

  v_proxy := null;
  return true;
end;
$$;

revoke all on function public.hercules_domain_agent_stage_netlify_deploy_proxy(text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_stage_netlify_deploy_proxy(text,timestamptz,text)
  to service_role;

create or replace function public.hercules_domain_agent_consume_netlify_deploy_proxy()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row record;
  v_proxy text;
  v_expires timestamptz;
begin
  select purpose,enabled,metadata,secret_ref
  into v_row
  from public.hercules_internal_service_keys
  where purpose='netlify-domain-agent-deploy-proxy'
  for update;

  if not found or v_row.enabled is not true or v_row.secret_ref is null then
    raise exception 'netlify_deploy_proxy_unavailable';
  end if;

  v_expires := nullif(v_row.metadata->>'expires_at','')::timestamptz;
  if v_expires is null or v_expires <= now() then
    update public.hercules_internal_service_keys
    set enabled=false,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'expired_at',now(),
          'consume_status','expired'
        )
    where purpose='netlify-domain-agent-deploy-proxy';
    raise exception 'netlify_deploy_proxy_expired';
  end if;

  v_proxy := public.hercules_get_secret(v_row.secret_ref);
  if v_proxy is null or v_proxy='' then
    raise exception 'netlify_deploy_proxy_unavailable';
  end if;

  update public.hercules_internal_service_keys
  set enabled=false,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'consumed_at',now(),
        'consume_status','consumed',
        'consumer','github-actions-oidc'
      )
  where purpose='netlify-domain-agent-deploy-proxy'
    and enabled=true;

  return jsonb_build_object(
    'proxy_path',v_proxy,
    'site_id',coalesce(v_row.metadata->>'site_id',''),
    'expires_at',v_expires
  );
end;
$$;

revoke all on function public.hercules_domain_agent_consume_netlify_deploy_proxy()
  from public, anon, authenticated;
grant execute on function public.hercules_domain_agent_consume_netlify_deploy_proxy()
  to service_role;
