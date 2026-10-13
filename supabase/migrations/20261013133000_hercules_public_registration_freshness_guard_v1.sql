-- Hercules public registration consumes only fresh, source-checked readiness.
-- The release switch remains owner-controlled and closed unless separately authorized.
-- Existing active members and existing synthetic certification route are unchanged.
-- No storefront, DNS, checkout, payment, ledger or release-switch mutation.
BEGIN;

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
  launch_ready boolean := false;
  public_open boolean := false;
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
    select g.launch_ready = true
       and g.checked_at >= now() - interval '30 minutes'
       and g.checked_at <= now() + interval '1 minute'
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
$function$;

DO $verify$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.hercules_bootstrap_organization(text,text)'::regprocedure)
    INTO v_def;
  IF position('interval ''30 minutes''' IN v_def)=0
    OR position('interval ''1 minute''' IN v_def)=0
    OR position('g.launch_ready = true' IN v_def)=0
    OR position('and not existing_member' IN v_def)=0
    OR position('and not synthetic_e2e' IN v_def)=0
    OR position('public-registration-open' IN v_def)=0 THEN
    raise exception 'registration_freshness_guard_missing';
  END IF;
END
$verify$;

COMMIT;
