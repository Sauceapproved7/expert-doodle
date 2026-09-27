create or replace function public.hercules_spaceship_mcp_store_registration(
  p_client_id text,
  p_client_secret text,
  p_redirect_uri text
)
returns boolean
language plpgsql
security definer
set search_path=public,vault
as $$
declare v_ref uuid;
begin
  if length(trim(coalesce(p_client_id,''))) < 4 then raise exception 'spaceship_mcp_client_id_invalid'; end if;
  if length(trim(coalesce(p_client_secret,''))) > 0
     and length(trim(coalesce(p_client_secret,''))) < 8
  then
    raise exception 'spaceship_mcp_client_secret_invalid';
  end if;
  if p_redirect_uri <> 'https://xbwuablxhhwsaoomsoco.supabase.co/functions/v1/hercules-private-bridge?spaceship_mcp_oauth_callback=1' then
    raise exception 'spaceship_mcp_redirect_uri_invalid';
  end if;

  select client_secret_secret_ref into v_ref
  from public.hercules_spaceship_mcp_oauth
  where singleton=true
  for update;

  if length(trim(coalesce(p_client_secret,''))) > 0 then
    if v_ref is null then
      v_ref := public.hercules_store_secret(
        p_client_secret,
        'spaceship-mcp-client-secret',
        'OAuth dynamic-registration client secret for Hercules Spaceship MCP.'
      );
    else
      perform vault.update_secret(
        v_ref,
        p_client_secret,
        'spaceship-mcp-client-secret',
        'OAuth dynamic-registration client secret for Hercules Spaceship MCP.',
        null
      );
    end if;
  else
    v_ref := null;
  end if;

  update public.hercules_spaceship_mcp_oauth
  set client_id=trim(p_client_id),
      client_secret_secret_ref=v_ref,
      redirect_uri=p_redirect_uri,
      status=case when status='configured' then status else 'registered' end,
      updated_at=now()
  where singleton=true;

  p_client_secret := null;
  return true;
end;
$$;

revoke all on function public.hercules_spaceship_mcp_store_registration(text,text,text)
  from public,anon,authenticated;
grant execute on function public.hercules_spaceship_mcp_store_registration(text,text,text)
  to service_role;

comment on function public.hercules_spaceship_mcp_store_registration(text,text,text) is
  'Stores Spaceship dynamic OAuth client registration. Supports public PKCE clients without a client secret and confidential clients with Vault-held secrets.';
