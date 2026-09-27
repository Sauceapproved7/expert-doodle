create table if not exists private.hercules_browser_standalone_tokens (
  token_sha256 text primary key,
  purpose text not null check (purpose in ('runtime','owner')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table private.hercules_browser_standalone_tokens enable row level security;

comment on table private.hercules_browser_standalone_tokens is
  'One-time Hercules Browser broker tokens. Raw token values are never stored.';

create or replace function public.hercules_browser_standalone_token_issue(
  p_purpose text default 'runtime',
  p_ttl_seconds integer default 90
)
returns text
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_token text;
  v_hash text;
  v_ttl integer;
begin
  if p_purpose not in ('runtime','owner') then
    raise exception 'unsupported_token_purpose';
  end if;

  v_ttl := greatest(30,least(coalesce(p_ttl_seconds,90),600));
  v_token := encode(gen_random_bytes(32),'hex');
  v_hash := encode(digest(v_token,'sha256'),'hex');

  insert into private.hercules_browser_standalone_tokens(
    token_sha256,purpose,expires_at,metadata
  )
  values(
    v_hash,p_purpose,now()+make_interval(secs=>v_ttl),
    jsonb_build_object('issued_by','hercules-browser-standalone-auth-broker')
  );

  return v_token;
end;
$$;

create or replace function public.hercules_browser_standalone_token_consume(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
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
  returning purpose,expires_at,metadata into v_row;

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

create or replace function public.hercules_browser_standalone_dispatch(
  p_path text,
  p_body jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, private, extensions, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
  v_path text;
begin
  v_path := coalesce(p_path,'');
  if v_path not in ('/api/autopilot','/api/navigate','/api/action','/api/new-session') then
    raise exception 'unsupported_browser_dispatch_path';
  end if;

  v_token := public.hercules_browser_standalone_token_issue('runtime',90);

  select net.http_post(
    url := 'https://hercules-browser-standalone.onrender.com' || v_path,
    headers := jsonb_build_object(
      'content-type','application/json',
      'authorization','Bearer ' || v_token
    ),
    body := coalesce(p_body,'{}'::jsonb),
    timeout_milliseconds := 65000
  ) into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.hercules_browser_standalone_owner_link_issue()
returns text
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  v_token text;
begin
  v_token := public.hercules_browser_standalone_token_issue('owner',300);
  return 'https://hercules-browser-standalone.onrender.com/#access=' || v_token;
end;
$$;

revoke all on function public.hercules_browser_standalone_token_issue(text,integer) from public,anon,authenticated;
revoke all on function public.hercules_browser_standalone_token_consume(text) from public,anon,authenticated;
revoke all on function public.hercules_browser_standalone_dispatch(text,jsonb) from public,anon,authenticated;
revoke all on function public.hercules_browser_standalone_owner_link_issue() from public,anon,authenticated;

grant execute on function public.hercules_browser_standalone_token_issue(text,integer) to service_role;
grant execute on function public.hercules_browser_standalone_token_consume(text) to service_role;
grant execute on function public.hercules_browser_standalone_dispatch(text,jsonb) to service_role;
grant execute on function public.hercules_browser_standalone_owner_link_issue() to service_role;

create or replace function private.hercules_browser_standalone_token_cleanup()
returns integer
language plpgsql
set search_path = private, pg_temp
as $$
declare
  v_count integer;
begin
  delete from private.hercules_browser_standalone_tokens
  where expires_at < now()-interval '1 hour'
     or consumed_at < now()-interval '1 hour';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

do $$
declare j bigint;
begin
  select jobid into j from cron.job where jobname='hercules-browser-standalone-token-cleanup' limit 1;
  if j is not null then perform cron.unschedule(j); end if;
end;
$$;

select cron.schedule(
  'hercules-browser-standalone-token-cleanup',
  '17 * * * *',
  'select private.hercules_browser_standalone_token_cleanup();'
);
