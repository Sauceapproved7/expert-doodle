-- Retire authenticated execution of the final two intentional SECURITY DEFINER RPCs.
-- Browser/user-facing access is moved behind authenticated Edge Functions, while
-- privileged database work remains service-role-only.

create or replace function public.hercules_bootstrap_organization_internal(
  p_user_id uuid,
  org_name text,
  org_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := p_user_id;
  org_id uuid;
  normalized_slug text := lower(trim(org_slug));
  owner_email text;
  owner_confirmed timestamptz;
  reserved_ok boolean := false;
  launch_ready boolean := false;
  public_open boolean := false;
  existing_member boolean := false;
  synthetic_e2e boolean := false;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if length(trim(coalesce(org_name,''))) < 1 or length(trim(org_name)) > 120 then
    raise exception 'invalid organization name';
  end if;
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'invalid slug';
  end if;

  select lower(email), email_confirmed_at
    into owner_email, owner_confirmed
  from auth.users
  where id = uid;

  if owner_email is null then raise exception 'authenticated user not found'; end if;
  if owner_confirmed is null then raise exception 'email confirmation required'; end if;

  select coalesce((
    select g.launch_ready
    from public.hercules_launch_gate_checks g
    order by g.checked_at desc
    limit 1
  ),false) into launch_ready;

  select coalesce((
    select l.status='active' and l.value->>'open'='true'
    from public.hercules_continuity_ledger l
    where l.key='public-registration-open'
    limit 1
  ),false) into public_open;

  select exists(
    select 1
    from public.hercules_memberships m
    where m.user_id=uid
      and m.status='active'
  ) into existing_member;

  synthetic_e2e := owner_email like 'hercules-onboard-%@example.com';

  if not (launch_ready and public_open)
     and not existing_member
     and not synthetic_e2e then
    raise exception 'public registration is not open';
  end if;

  if normalized_slug='sauceapproved' then
    select exists(
      select 1
      from public.hercules_pending_domain_claims p
      where p.status='pending_owner'
        and p.intended_org_slug=normalized_slug
        and lower(coalesce(p.contact_email,''))=owner_email
    ) into reserved_ok;
    if not reserved_ok then raise exception 'reserved organization slug'; end if;
  end if;

  insert into public.hercules_organizations(name,slug,owner_user_id)
  values(trim(org_name),normalized_slug,uid)
  returning id into org_id;

  return org_id;
end
$$;

revoke all on function public.hercules_bootstrap_organization_internal(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.hercules_bootstrap_organization_internal(uuid,text,text)
  to service_role;

create or replace function public.hercules_chat_current_usage_internal(p_user_id uuid)
returns table (
  plan text,
  period text,
  ai_runs integer,
  request_count bigint,
  input_tokens bigint,
  cached_input_tokens bigint,
  output_tokens bigint,
  cost_microusd bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select p_user_id as uid
    where p_user_id is not null
  ),
  billing as (
    select coalesce(
      (
        select b.plan
        from public.hercules_billing b, target
        where b.user_id=target.uid
        limit 1
      ),
      'preview'
    ) as plan
  ),
  agg as (
    select
      count(*) filter (where l.status='completed') as request_count,
      coalesce(sum(l.input_tokens) filter (where l.status='completed'),0)::bigint as input_tokens,
      coalesce(sum(l.cached_input_tokens) filter (where l.status='completed'),0)::bigint as cached_input_tokens,
      coalesce(sum(l.output_tokens) filter (where l.status='completed'),0)::bigint as output_tokens,
      coalesce(sum(l.cost_microusd) filter (where l.status='completed'),0)::bigint as cost_microusd
    from private.hercules_usage_ledger l, target
    where l.user_id=target.uid
      and l.created_at >= date_trunc('month',now())
  )
  select
    billing.plan,
    to_char(now(),'YYYY-MM') as period,
    coalesce(
      (
        select u.ai_runs
        from public.hercules_usage u, target
        where u.user_id=target.uid
          and u.period=to_char(now(),'YYYY-MM')
      ),
      0
    )::integer,
    agg.request_count,
    agg.input_tokens,
    agg.cached_input_tokens,
    agg.output_tokens,
    agg.cost_microusd
  from billing,agg
  where exists(select 1 from target);
$$;

revoke all on function public.hercules_chat_current_usage_internal(uuid)
  from public, anon, authenticated;
grant execute on function public.hercules_chat_current_usage_internal(uuid)
  to service_role;

-- Retire direct authenticated execution. The Edge Functions now validate the
-- authenticated user and invoke the service-role-only internal equivalents.
revoke all on function public.hercules_bootstrap_organization(text,text)
  from public, anon, authenticated;
revoke all on function public.hercules_chat_current_usage()
  from public, anon, authenticated;

comment on function public.hercules_bootstrap_organization_internal(uuid,text,text) is
  'Service-role-only organization bootstrap. The Hercules launch Edge Function authenticates the user and supplies the verified user id.';
comment on function public.hercules_chat_current_usage_internal(uuid) is
  'Service-role-only per-user chat usage summary. The JWT-verified Hercules Chat Edge Function supplies the authenticated user id.';
comment on function public.hercules_bootstrap_organization(text,text) is
  'Legacy direct-RPC bootstrap retained for migration compatibility; client execution is revoked.';
comment on function public.hercules_chat_current_usage() is
  'Legacy direct-RPC usage summary retained for migration compatibility; client execution is revoked.';
