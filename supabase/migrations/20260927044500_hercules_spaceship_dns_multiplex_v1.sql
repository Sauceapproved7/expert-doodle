create or replace function public.hercules_spaceship_dns_submit(
  p_action text,
  p_replace_custom_conflicts boolean default false
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
  v_edge_action text;
begin
  if p_action = 'inspect' then
    v_edge_action := 'inspect_shopify_dns';
  elsif p_action = 'reconcile' then
    v_edge_action := 'reconcile_shopify_dns';
  else
    raise exception 'spaceship_dns_action_not_allowed';
  end if;

  if p_action = 'inspect' and p_replace_custom_conflicts then
    raise exception 'replace_flag_not_allowed_for_inspect';
  end if;

  select secret_ref
    into v_secret_ref
    from public.hercules_internal_service_keys
   where purpose = 'spaceship-dns'
     and enabled = true
   limit 1;

  if v_secret_ref is null then
    raise exception 'spaceship_dns_internal_secret_missing';
  end if;

  v_internal_key := public.hercules_get_secret(v_secret_ref);
  if v_internal_key is null or length(v_internal_key) < 32 then
    raise exception 'spaceship_dns_internal_secret_unavailable';
  end if;

  select net.http_post(
    url := 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-hercules-internal-key', v_internal_key
    ),
    body := jsonb_build_object(
      'action', v_edge_action,
      'replaceCustomConflicts', coalesce(p_replace_custom_conflicts, false)
    ),
    timeout_milliseconds := 65000
  )
  into v_request_id;

  v_internal_key := null;
  return v_request_id;
end;
$$;

revoke all on function public.hercules_spaceship_dns_submit(text,boolean)
  from public, anon, authenticated;
grant execute on function public.hercules_spaceship_dns_submit(text,boolean)
  to service_role;

comment on function public.hercules_spaceship_dns_submit(text,boolean) is
  'Service-role-only async bridge multiplexed through Hercules Private Bridge to avoid consuming another Edge Function slot.';
