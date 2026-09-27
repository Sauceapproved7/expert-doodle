begin;

create or replace function public.hercules_bootstrap_organization(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  uid uuid := (select auth.uid());
  org_id uuid;
  normalized_slug text := lower(trim(org_slug));
  owner_email text;
  owner_confirmed timestamptz;
  reserved_ok boolean := false;
  launch_open boolean := false;
  existing_member boolean := false;
  synthetic_e2e boolean := false;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then raise exception 'invalid slug'; end if;

  select lower(email), email_confirmed_at
    into owner_email, owner_confirmed
  from auth.users
  where id = uid;

  if owner_confirmed is null then raise exception 'email confirmation required'; end if;

  select coalesce((
    select g.launch_ready
    from public.hercules_launch_gate_checks g
    order by g.checked_at desc
    limit 1
  ),false) into launch_open;

  select exists(
    select 1
    from public.hercules_memberships m
    where m.user_id=uid
      and m.status='active'
  ) into existing_member;

  synthetic_e2e := owner_email like 'hercules-onboard-%@example.com';

  if not launch_open and not existing_member and not synthetic_e2e then
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
$function$;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.hercules_bootstrap_organization(text,text)'::regprocedure)
  into v_def;

  if position('public registration is not open' in v_def)=0
     or position('hercules_launch_gate_checks' in v_def)=0
     or position('hercules-onboard-%@example.com' in v_def)=0 then
    raise exception 'Hercules public registration gate was not installed';
  end if;
end
$$;

commit;
