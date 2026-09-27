create or replace function public.hercules_spaceship_mcp_launch_browser()
returns bigint
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_ref uuid;
  v_key text;
  v_id bigint;
begin
  select secret_ref into v_ref
  from public.hercules_internal_service_keys
  where purpose='spaceship-dns' and enabled=true
  limit 1;
  if v_ref is null then raise exception 'spaceship_dns_internal_secret_missing'; end if;

  v_key := public.hercules_get_secret(v_ref);
  select net.http_post(
    url:='https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge',
    headers:=jsonb_build_object(
      'content-type','application/json',
      'x-hercules-internal-key',v_key
    ),
    body:='{"action":"spaceship_mcp_handoff_launch_browser"}'::jsonb,
    timeout_milliseconds:=30000
  ) into v_id;
  v_key := null;
  return v_id;
end;
$function$;

revoke all on function public.hercules_spaceship_mcp_launch_browser() from public, anon, authenticated;
grant execute on function public.hercules_spaceship_mcp_launch_browser() to service_role;

comment on function public.hercules_spaceship_mcp_launch_browser() is
  'Queues a one-time Spaceship OAuth handoff into the owned Hercules Browser without exposing the internal service key.';
