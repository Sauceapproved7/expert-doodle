-- Enforce exactly one active owner membership per organization.
-- Fail closed if legacy data already violates the invariant.

do $$
begin
  if exists (
    select 1
    from public.hercules_memberships
    where role='owner' and status='active'
    group by organization_id
    having count(*) > 1
  ) then
    raise exception 'multiple_active_owners_detected';
  end if;
end
$$;

create unique index if not exists hercules_memberships_one_active_owner_per_org
  on public.hercules_memberships (organization_id)
  where role='owner' and status='active';
