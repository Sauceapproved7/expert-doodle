create or replace function public.hercules_spaceship_mcp_store_public_registration(
  p_client_id text,
  p_redirect_uri text
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if length(trim(coalesce(p_client_id,''))) < 4 then raise exception 'spaceship_mcp_client_id_invalid'; end if;
  if p_redirect_uri !~ '^https://xbwuablxhhwsaoomsoco[.]supabase[.]co/functions/v1/hercules-private-bridge' then
    raise exception 'spaceship_mcp_redirect_uri_invalid';
  end if;

  update public.hercules_spaceship_mcp_oauth
  set client_id=trim(p_client_id),
      client_secret_secret_ref=null,
      redirect_uri=p_redirect_uri,
      status=case when status='configured' then status else 'registered' end,
      updated_at=now()
  where singleton=true;

  return true;
end;
$$;

revoke all on function public.hercules_spaceship_mcp_store_public_registration(text,text) from public,anon,authenticated;
grant execute on function public.hercules_spaceship_mcp_store_public_registration(text,text) to service_role;

comment on function public.hercules_spaceship_mcp_store_public_registration(text,text) is
  'Stores the public Spaceship OAuth client identifier; PKCE protects authorization and no client secret is expected.';
