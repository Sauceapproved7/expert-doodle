import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,"..");
const migrations=resolve(repo,"supabase/migrations");
const migrationName=readdirSync(migrations).find(x=>x.includes("studio_founding_pilot_commercial_v1"));
const termsPath=resolve(repo,"docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-TERMS-CANDIDATE-V1.md");
const privacyPath=resolve(repo,"docs/legal/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-PRIVACY-CANDIDATE-V1.md");
const bridge=readFileSync(resolve(repo,"supabase/functions/hercules-private-bridge/index.ts"),"utf8");
const ui=readFileSync(resolve(repo,"supabase/functions/hercules-integrations/index.ts"),"utf8");

test("Studio Founding Pilot has separate one-time legal candidates",()=>{
  assert.equal(existsSync(termsPath),true);
  assert.equal(existsSync(privacyPath),true);
  const terms=readFileSync(termsPath,"utf8");
  const privacy=readFileSync(privacyPath,"utf8");
  assert.match(terms,/\$99 one time/i);
  assert.match(terms,/does not automatically renew/i);
  assert.match(terms,/7 calendar days/i);
  assert.match(terms,/SoundWorld/i);
  assert.match(terms,/pre-production/i);
  assert.match(privacy,/Shopify/i);
  assert.match(privacy,/Supabase/i);
  assert.match(privacy,/SauceApproved Studio/i);
});

test("Studio Founding Pilot has a dedicated authenticated commercial gate",()=>{
  assert.ok(migrationName,"Studio Founding Pilot commercial migration missing");
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  assert.match(sql,/sauceapproved-studio-founding-pilot/);
  assert.match(sql,/founding_pilot_one_time/);
  assert.match(sql,/candidate_price_cents['",:\s]+9900/);
  assert.match(sql,/gid:\/\/shopify\/Product\/15397259477312/);
  assert.match(sql,/67601341153600/);
  assert.match(sql,/SA-STUDIO-PILOT-001/);
  assert.match(sql,/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-TERMS-CANDIDATE-V1\.md/);
  assert.match(sql,/SAUCEAPPROVED-STUDIO-FOUNDING-PILOT-PRIVACY-CANDIDATE-V1\.md/);
  assert.match(sql,/hercules_studio_pilot_owner_approve_bundle/);
  assert.match(sql,/APPROVE SAUCEAPPROVED STUDIO FOUNDING PILOT/);
  assert.match(sql,/hercules_studio_pilot_record_shopify_provider_ready/);
  assert.match(sql,/hercules_studio_pilot_record_shopify_payment_path/);
  assert.match(sql,/payment_provider_ready/);
  assert.match(sql,/payment_path_verified/);
  assert.match(sql,/role='owner'/);
  assert.match(sql,/revoke all on function public\.hercules_studio_pilot_owner_approve_bundle/);
  assert.match(sql,/grant execute on function public\.hercules_studio_pilot_owner_approve_bundle/);
});

test("Studio Founding Pilot owner approval is separate from monthly Studio approval",()=>{
  assert.match(bridge,/studio_pilot_commercial_bundle_status/);
  assert.match(bridge,/studio_pilot_commercial_bundle_approve/);
  assert.match(bridge,/hercules_studio_pilot_owner_approve_bundle/);
  assert.match(bridge,/sauceapproved-studio-founding-pilot/);
  assert.match(ui,/Studio Founding Pilot Commercial Packet/);
  assert.match(ui,/\$99 one-time/);
  assert.match(ui,/studio_pilot_commercial_bundle_status/);
  assert.match(ui,/studio_pilot_commercial_bundle_approve/);
  assert.match(ui,/window\.prompt\('Type exactly: '/);
});

test("Studio Founding Pilot payment lane is Shopify-native and does not authorize Stripe monthly checkout",()=>{
  const sql=readFileSync(resolve(migrations,migrationName),"utf8");
  assert.match(sql,/payment_provider['",:\s]+shopify/i);
  assert.match(sql,/checkoutApiSupported/);
  assert.match(sql,/setupRequired/);
  assert.match(sql,/payment_path_verified/);
  assert.doesNotMatch(sql,/hercules_activate_software_checkout\('sauceapproved-studio'/);
});
