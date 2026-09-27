create or replace function public.hercules_browser_standalone_token_consume_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-fA-F]{64}$' then
    return jsonb_build_object('ok',false,'error','invalid_token_format');
  end if;

  return public.hercules_browser_standalone_token_consume(p_token);
end;
$$;

comment on function public.hercules_browser_standalone_token_consume_public(text) is
  'Narrow public verifier for high-entropy, one-time Hercules Browser broker tokens. Exposes no token ledger rows.';

revoke all on function public.hercules_browser_standalone_token_consume_public(text) from public,authenticated;
grant execute on function public.hercules_browser_standalone_token_consume_public(text) to anon,service_role;
