create or replace function public.hercules_supabase_management_validate_callback_state(p_state text)
returns boolean language plpgsql security definer set search_path=public,extensions
as $$
declare v_expected text;v_started timestamptz;v_status text;
begin
  select oauth_state_sha256,oauth_started_at,status into v_expected,v_started,v_status
  from public.hercules_supabase_management_oauth where singleton=true;
  if v_status<>'pending_authorization' or v_expected is null
    or v_expected<>encode(extensions.digest(coalesce(p_state,''),'sha256'),'hex')
    or v_started is null or v_started<now()-interval '20 minutes' then
    raise exception 'oauth_state_mismatch';
  end if;
  return true;
end $$;

revoke all on function public.hercules_supabase_management_validate_callback_state(text) from public,anon,authenticated;
grant execute on function public.hercules_supabase_management_validate_callback_state(text) to service_role;
