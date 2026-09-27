revoke all on table private.hercules_browser_standalone_tokens from anon,authenticated;

drop policy if exists "standalone token anon consume" on private.hercules_browser_standalone_tokens;

create or replace function private.hercules_browser_standalone_token_consume_bridge(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions, pg_temp
as $$
declare
  v_row record;
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('ok',false,'error','invalid_token_format');
  end if;

  update private.hercules_browser_standalone_tokens
  set consumed_at=now()
  where token_sha256=encode(digest(p_token,'sha256'),'hex')
    and consumed_at is null
    and expires_at > now()
  returning purpose,expires_at into v_row;

  if not found then
    return jsonb_build_object('ok',false,'error','token_invalid_expired_or_consumed');
  end if;

  return jsonb_build_object(
    'ok',true,
    'purpose',v_row.purpose,
    'expires_at',v_row.expires_at
  );
end;
$$;

revoke all on function private.hercules_browser_standalone_token_consume_bridge(text) from public,authenticated,anon;
grant usage on schema private to anon;
grant execute on function private.hercules_browser_standalone_token_consume_bridge(text) to anon,service_role;

create or replace function public.hercules_browser_standalone_token_consume_public(p_token text)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('ok',false,'error','invalid_token_format');
  end if;

  return private.hercules_browser_standalone_token_consume_bridge(p_token);
end;
$$;

revoke all on function public.hercules_browser_standalone_token_consume_public(text) from public,authenticated;
grant execute on function public.hercules_browser_standalone_token_consume_public(text) to anon,service_role;
