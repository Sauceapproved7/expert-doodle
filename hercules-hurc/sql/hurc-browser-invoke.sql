create or replace function public.hercules_hurc_prepare_quicknode()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret_ref uuid;
  v_internal_key text;
  v_request_id bigint;
begin
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
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-hurc-browser',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hercules-internal-key', v_internal_key
    ),
    body := '{"action":"prepare_quicknode"}'::jsonb,
    timeout_milliseconds := 45000
  )
  into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_hurc_prepare_quicknode() from public, anon, authenticated;
grant execute on function public.hercules_hurc_prepare_quicknode() to service_role;

comment on function public.hercules_hurc_prepare_quicknode() is
  'Server-only HURC Base Sepolia faucet preparation through the Hercules browser gateway. Returns pg_net request id only.';
