-- Hercules Gatehouse metadata-only customer report inbox.
-- Reports remain withheld. Never expose summary, delivery actions or write privileges.
alter table public.gatehouse_customer_reports enable row level security;
revoke all on public.gatehouse_customer_reports from anon, authenticated;
grant select (id, site_id, owner_user_id, delivery_state, created_at)
 on public.gatehouse_customer_reports to authenticated;
create policy gatehouse_reports_owner_withheld_metadata
 on public.gatehouse_customer_reports
 for select to authenticated
 using (
   (select auth.uid()) = owner_user_id
   and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false) = false
   and delivery_state = 'withheld'
 );
-- The "summary" jsonb column is intentionally NOT granted to authenticated.
-- No INSERT, UPDATE, DELETE or paid delivery pathway is introduced.
