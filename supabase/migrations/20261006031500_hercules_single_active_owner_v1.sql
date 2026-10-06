do $$
begin
  if exists (
    select 1
    from public.hercules_memberships
    where role='owner' and status='active'
    group by organization_id
    having count(*) > 1
  ) then
    raise exception 'multiple_active_owners_exist';
  end if;
end
$$;

create unique index if not exists hercules_memberships_one_active_owner
on public.hercules_memberships (organization_id)
where role='owner' and status='active';
