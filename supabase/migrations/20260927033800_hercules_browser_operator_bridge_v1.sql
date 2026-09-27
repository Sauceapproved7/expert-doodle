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
    timeout_milliseconds := 65000
  )
  into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_browser_submit(jsonb) from public, anon, authenticated;
grant execute on function public.hercules_browser_submit(jsonb) to service_role;

comment on function public.hercules_browser_submit(jsonb) is
  'Server-only operator bridge to the owned Hercules Browser control surface. Secrets remain server-side; returns pg_net request id only.';

create or replace function public.hercules_browser_result(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row record;
  v_body jsonb;
begin
  select id, status_code, content_type, content, timed_out, error_msg, created
    into v_row
    from net._http_response
   where id = p_request_id
   limit 1;

  if not found then
    return jsonb_build_object('ready', false, 'requestId', p_request_id);
  end if;

  begin
    v_body := v_row.content::jsonb;
  exception when others then
    v_body := jsonb_build_object('raw', left(coalesce(v_row.content,''), 20000));
  end;

  return jsonb_build_object(
    'ready', true,
    'requestId', v_row.id,
    'statusCode', v_row.status_code,
    'contentType', v_row.content_type,
    'timedOut', v_row.timed_out,
    'error', v_row.error_msg,
    'created', v_row.created,
    'body', v_body
  );
end;
$$;

revoke all on function public.hercules_browser_result(bigint) from public, anon, authenticated;
grant execute on function public.hercules_browser_result(bigint) to service_role;

comment on function public.hercules_browser_result(bigint) is
  'Reads compact Hercules Browser pg_net execution results without exposing gateway credentials.';
