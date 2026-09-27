-- Hercules Browser operator bridge timeout v2
-- Date: 2026-09-27
-- Gives the serialized browser admission queue enough bounded time to drain.

create or replace function public.hercules_browser_submit(p_request jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_ref uuid;
  v_internal_key text;
  v_request_id bigint;
  v_action text;
  v_url text;
  v_steps jsonb;
  v_step jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'browser_request_object_required';
  end if;

  if length(p_request::text) > 262144 then
    raise exception 'browser_request_too_large';
  end if;

  v_action := coalesce(p_request->>'action', 'navigate');
  if v_action not in ('navigate','scrape','screenshot','interact','close_session') then
    raise exception 'browser_action_not_allowed';
  end if;

  if v_action = 'close_session' then
    if coalesce(p_request->>'sessionId','') = '' then
      raise exception 'browser_session_id_required';
    end if;
  else
    v_url := p_request->>'url';
    if coalesce(v_url,'') = '' and coalesce(p_request->>'sessionId','') = '' then
      raise exception 'browser_url_or_session_required';
    end if;
    if coalesce(v_url,'') <> '' and v_url !~* '^https?://' then
      raise exception 'browser_url_protocol_not_allowed';
    end if;
  end if;

  if p_request ? 'timeoutMs'
     and ((p_request->>'timeoutMs')::bigint < 1000 or (p_request->>'timeoutMs')::bigint > 60000) then
    raise exception 'browser_timeout_out_of_range';
  end if;

  if p_request ? 'steps' then
    v_steps := p_request->'steps';
    if jsonb_typeof(v_steps) <> 'array' then
      raise exception 'browser_steps_array_required';
    end if;
    if jsonb_array_length(v_steps) > 25 then
      raise exception 'browser_too_many_steps';
    end if;
    for v_step in select value from jsonb_array_elements(v_steps)
    loop
      if coalesce(v_step->>'type','') not in ('click','type','wait','extract') then
        raise exception 'browser_step_not_allowed';
      end if;
    end loop;
  end if;

  select secret_ref
    into v_secret_ref
    from public.hercules_internal_service_keys
   where purpose = 'browser-gateway'
     and enabled = true
   limit 1;

  if v_secret_ref is null then
    raise exception 'browser_gateway_secret_missing';
  end if;

  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key) < 32 then
    raise exception 'browser_gateway_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-browser',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hercules-internal-key', v_internal_key
    ),
    body := p_request,
    timeout_milliseconds := 120000
  )
  into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_browser_submit(jsonb) from public, anon, authenticated;
grant execute on function public.hercules_browser_submit(jsonb) to service_role;

comment on function public.hercules_browser_submit(jsonb) is
  'Server-only operator bridge to the owned Hercules Browser control surface. Uses a 120-second pg_net timeout so the bounded serialized browser admission queue can drain without exposing gateway credentials.';
