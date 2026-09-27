create or replace function public.hercules_browser_autoresume(p_request jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_host text;
  v_session_id text;
  v_request jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'browser_request_object_required';
  end if;

  v_url := nullif(p_request->>'url','');
  if v_url is null then
    raise exception 'browser_autoresume_url_required';
  end if;
  if v_url !~* '^https?://' then
    raise exception 'browser_url_protocol_not_allowed';
  end if;

  v_host := lower(split_part(split_part(v_url, '://', 2), '/', 1));

  select r.result->'summary'->>'sessionId'
    into v_session_id
    from public.hercules_browser_runs r
   where r.status = 'succeeded'
     and r.completed_at is not null
     and r.completed_at >= now() - interval '9 minutes'
     and coalesce(r.result->'summary'->>'sessionId','') <> ''
     and (
       lower(split_part(split_part(coalesce(r.target_url,''), '://', 2), '/', 1)) = v_host
       or lower(split_part(split_part(coalesce(r.result->'summary'->>'url',''), '://', 2), '/', 1)) = v_host
     )
   order by r.completed_at desc
   limit 1;

  v_request := p_request || jsonb_build_object('persistSession', true);
  if v_session_id is not null then
    v_request := v_request || jsonb_build_object('sessionId', v_session_id);
  else
    v_request := v_request - 'sessionId';
  end if;

  return public.hercules_browser_submit(v_request);
end;
$$;

revoke all on function public.hercules_browser_autoresume(jsonb) from public, anon, authenticated;
grant execute on function public.hercules_browser_autoresume(jsonb) to service_role;

comment on function public.hercules_browser_autoresume(jsonb) is
  'Server-only Hercules Browser helper that safely reuses a recent same-host session when available and always retains the target URL so stale or restarted sessions recover by navigation.';
