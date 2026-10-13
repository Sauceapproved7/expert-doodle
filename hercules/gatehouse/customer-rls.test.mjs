import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../supabase/gatehouse_customer_direct_rls.sql",import.meta.url),"utf8");
test("public API enrollment uses authenticated owner-scoped RLS, never service-role key",()=>{
 assert.match(sql,/grant select, insert on public\.gatehouse_customer_sites to authenticated;/i);
 assert.match(sql,/for insert to authenticated/i);
 assert.match(sql,/with check/i);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/owner_user_id/);
 assert.match(sql,/create unique index gatehouse_customer_one_site_per_user_uq/i);
 assert.doesNotMatch(sql,/^\s*grant[^\n]*on public\.gatehouse_customer_reports/im);
 assert.doesNotMatch(sql,/grant .* to anon;/i);
 assert.doesNotMatch(sql,/disable row level security|security definer/i);
});
