import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const p=new URL("../supabase/migrations/20260928094500_harden_software_checkout_rpcs.sql",import.meta.url);

test("checkout readiness and dry-run are internal service-role surfaces",()=>{
  const sql=fs.readFileSync(p,"utf8");
  assert.match(sql,/revoke all on function public\.hercules_software_checkout_readiness\(text\) from public, anon, authenticated/);
  assert.match(sql,/revoke all on function public\.hercules_software_checkout_dry_run\(text,text\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function public\.hercules_software_checkout_readiness\(text\) to service_role/);
  assert.match(sql,/grant execute on function public\.hercules_software_checkout_dry_run\(text,text\) to service_role/);
  assert.match(sql,/grant execute on function public\.hercules_software_owner_approve\(text,text,text\) to authenticated/);
});
