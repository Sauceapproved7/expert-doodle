-- Hercules Gatehouse single-site authenticated pilot, additive permissions only.
-- Existing accounts, reports, merchants, orders and checkout are untouched.
create unique index gatehouse_customer_one_site_per_user_uq
 on public.gatehouse_customer_sites(owner_user_id);
create policy "gatehouse_sites_authenticated_insert"
 on public.gatehouse_customer_sites
 for insert to authenticated
 with check (
  (select auth.uid()) = owner_user_id
  and stage = 'awaiting-domain-control'
  and consent_version = 'gatehouse-diagnostic-v1'
  and authorized_at > now() - interval '10 minutes'
  and authorized_at < now() + interval '1 minute'
 );
grant select, insert on public.gatehouse_customer_sites to authenticated;
-- No grant on public.gatehouse_customer_reports; its contents remain owner-only via trusted server in a future audited build.
