update public.hercules_browser_workers
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'warmup_urls',
  jsonb_build_array(
    'https://hercules-browser-gateway.onrender.com/health',
    'https://hercules-browser-api.onrender.com'
  ),
  'cold_start_recovery',
  true
),
updated_at = now()
where name='primary';

create or replace function public.hercules_browser_agent_submit(
  p_url text,
  p_goal text,
  p_allowed_domains text[] default '{}'::text[],
  p_max_steps integer default 4,
  p_inputs jsonb default '{}'::jsonb,
  p_requested_by text default 'chatgpt-operator'
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_ref uuid;
  v_internal_key text;
  v_request_id bigint;
  v_url text;
  v_goal text;
  v_domains text[];
  v_domain text;
begin
  v_url := trim(coalesce(p_url,''));
  v_goal := trim(coalesce(p_goal,''));

  if v_url = '' or v_url !~* '^https?://' then
    raise exception 'browser_agent_valid_http_url_required';
  end if;
  if length(v_url) > 2048 then raise exception 'browser_agent_url_too_long'; end if;
  if v_goal = '' or length(v_goal) > 12000 then raise exception 'browser_agent_goal_invalid'; end if;
  if p_max_steps is null or p_max_steps < 1 or p_max_steps > 6 then
    raise exception 'browser_agent_max_steps_out_of_range';
  end if;
  if p_inputs is null or jsonb_typeof(p_inputs) <> 'object' or length(p_inputs::text) > 32768 then
    raise exception 'browser_agent_inputs_invalid';
  end if;

  v_domains := coalesce(p_allowed_domains,'{}'::text[]);
  if coalesce(array_length(v_domains,1),0) > 10 then
    raise exception 'browser_agent_too_many_allowed_domains';
  end if;
  foreach v_domain in array v_domains loop
    if v_domain is null
       or length(v_domain) > 253
       or lower(trim(v_domain)) !~ '^[a-z0-9.-]+$'
       or trim(v_domain) like '.%'
       or trim(v_domain) like '%.' then
      raise exception 'browser_agent_allowed_domain_invalid';
    end if;
  end loop;

  select secret_ref into v_secret_ref
  from public.hercules_internal_service_keys
  where purpose='browser-agent' and enabled=true
  limit 1;

  if v_secret_ref is null then raise exception 'browser_agent_internal_secret_missing'; end if;
  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key) < 32 then
    raise exception 'browser_agent_internal_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-browser-agent',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-hercules-internal-key',v_internal_key
    ),
    body := jsonb_build_object(
      'action','run',
      'url',v_url,
      'goal',v_goal,
      'allowed_domains',to_jsonb(v_domains),
      'max_steps',p_max_steps,
      'inputs',p_inputs,
      'requested_by',left(coalesce(p_requested_by,'chatgpt-operator'),200)
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_browser_agent_submit(text,text,text[],integer,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.hercules_browser_agent_submit(text,text,text[],integer,jsonb,text)
  to service_role;

comment on function public.hercules_browser_agent_submit(text,text,text[],integer,jsonb,text) is
  'Service-role-only operator bridge to Hercules Browser Agent with cold-start-aware execution allowance.';
