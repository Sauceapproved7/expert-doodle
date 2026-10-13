import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../../supabase/gatehouse_private_intake.sql",import.meta.url),"utf8");
const edge=readFileSync(new URL("../../supabase/functions/hercules-gatehouse-customer-intake/index.ts",import.meta.url),"utf8");

test("dedicated tables restrict all public roles, enable RLS and bind report rows to the matching site owner",()=>{
 for(const table of ["gatehouse_customer_sites","gatehouse_customer_reports"]){
  assert.match(sql,new RegExp("create table(?: if not exists)? public\\."+table,"i"));
  assert.match(sql,new RegExp("alter table public\\."+table+" enable row level security","i"));
  assert.match(sql,new RegExp("revoke all on public\\."+table+" from anon, authenticated","i"));
 }
 assert.match(sql,/foreign key\s*\(site_id,\s*owner_user_id\)/i);
 assert.match(sql,/references public\.gatehouse_customer_sites\s*\(id,\s*owner_user_id\)/i);
 assert.match(sql,/unique\s*\(owner_user_id,\s*origin\)/i);
 assert.match(sql,/delivery_state text not null default 'withheld'/i);
 assert.match(sql,/check\s*\(delivery_state = 'withheld'\)/i);
 assert.doesNotMatch(sql,/grant\s+(select|insert|update|delete)\s+on.*\s+to\s+anon/i);
});
test("auth JWT is checked server-side; all database operations scope to the authenticated user",()=>{
 assert.match(edge,/auth\.getUser\(token\)/);
 assert.match(edge,/owner_user_id:\s*user\.id/);
 assert.match(edge,/\.eq\(['"]owner_user_id['"],\s*user\.id\)/);
 assert.match(edge,/normalizeCustomerRequest/);
 assert.match(edge,/buildTenantSiteRow/);
 assert.match(edge,/content-type/i);
 assert.match(edge,/body-too-large/i);
 assert.doesNotMatch(edge,/access-control-allow-origin/i);
 assert.doesNotMatch(edge,/\.from\(['"](?:orders|customers|hercules_provider_connections)['"]\)/);
 assert.doesNotMatch(edge,/refundCreate|mutation\s|fulfillmentCreate|checkoutSession/i);
});
test("new backend does not claim paid report delivery or exposed site scanning",()=>{
 assert.doesNotMatch(edge,/deliveryAuthorized:\s*true|purchaseEnabled:\s*true/);
 assert.doesNotMatch(edge,/fetch\([^\n]+(?:user|website|origin)/i);
 assert.match(edge,/assessDelivery\(/);
 assert.match(edge,/reportDeliveryEnabled/);
});

test("commercial enrollment remains disabled unless separately approved at runtime",()=>{
 assert.match(edge,/GATEHOUSE_CUSTOMER_INTAKE_APPROVED/);
 assert.match(edge,/customer-intake-not-open/);
 assert.match(edge,/!==\s*'true'/);
});
