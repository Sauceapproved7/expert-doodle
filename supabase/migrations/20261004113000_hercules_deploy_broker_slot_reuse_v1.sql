create or replace function public.hercules_deploy_broker_submit(p_request jsonb)
returns bigint
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_ref uuid;
  v_key text;
  v_id bigint;
  v_action text;
  v_target text;
  v_edge_action text;
  v_body jsonb;
begin
  if jsonb_typeof(p_request) <> 'object' then raise exception 'deploy_broker_request_invalid'; end if;
  v_action := coalesce(p_request->>'action','');
  v_target := coalesce(p_request->>'target','');
  if v_action not in ('status','deploy','verify','rollback') then raise exception 'deploy_broker_action_denied'; end if;
  if v_target !~ '^[a-z0-9][a-z0-9-]{2,63}$' then raise exception 'deploy_broker_target_invalid'; end if;
  if p_request::text ~* '(password|secret|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token)' then
    raise exception 'deploy_broker_secret_shaped_input_denied';
  end if;

  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='deploy-broker-control' and enabled=true
  limit 1;
  if v_ref is null then raise exception 'deploy_broker_control_secret_missing'; end if;

  v_key := public.hercules_get_secret(v_ref);
  if v_key is null or length(v_key) < 32 then raise exception 'deploy_broker_control_secret_missing'; end if;

  v_edge_action := case v_action
    when 'status' then 'vault_render_status'
    when 'deploy' then 'vault_render_deploy'
    when 'verify' then 'vault_render_verify'
    when 'rollback' then 'vault_render_rollback'
  end;
  v_body := p_request || jsonb_build_object('action',v_edge_action);

  select net.http_post(
    url:='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-deployment-broker',
    headers:=jsonb_build_object('content-type','application/json','x-hercules-internal-key',v_key),
    body:=v_body,
    timeout_milliseconds:=30000
  ) into v_id;

  v_key := null;
  return v_id;
end;
$$;

revoke all on function public.hercules_deploy_broker_submit(jsonb) from public, anon, authenticated;
grant execute on function public.hercules_deploy_broker_submit(jsonb) to service_role;
