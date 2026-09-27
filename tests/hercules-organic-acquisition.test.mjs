import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const config=JSON.parse(await readFile(new URL("../governance/hercules-organic-acquisition-v1.json",import.meta.url),"utf8"));
const launch=await readFile(new URL("../supabase/functions/hercules-launch/index.ts",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20260927103300_hercules_organic_acquisition_v1.sql",import.meta.url),"utf8");

test("organic acquisition config selects channels, proof motions, and one pilot CTA",()=>{
  assert.equal(config.schema,"sauceapproved.hercules.organic-acquisition");
  assert.equal(config.version,1);
  assert.equal(config.primaryCta,"founding_pilot");
  assert.deepEqual(config.channels.map(x=>x.id),[
    "linkedin","youtube","short_video","x","seo","partner_referral","targeted_outbound"
  ]);
  assert.ok(config.weeklyProofEngine.length>=6);
  assert.equal(config.paidAcquisition.enabled,false);
});

test("launch surface preserves first-touch attribution through pilot request and activation",()=>{
  assert.match(launch,/hercules_attribution_v1/);
  assert.match(launch,/utm_source/);
  assert.match(launch,/utm_medium/);
  assert.match(launch,/utm_campaign/);
  assert.match(launch,/utm_content/);
  assert.match(launch,/attribution_id/);
  assert.match(launch,/landing_view/);
  assert.match(launch,/pilot_request/);
  assert.match(launch,/first_verified_useful_action/);
  assert.match(launch,/attribution:acquisition/);
});

test("organic funnel measurement remains protected from client roles",()=>{
  assert.match(migration,/create or replace view public\.hercules_organic_acquisition_funnel_v1/i);
  assert.match(migration,/landing_view/);
  assert.match(migration,/pilot_request/);
  assert.match(migration,/first_verified_useful_action/);
  assert.match(migration,/revoke all on public\.hercules_organic_acquisition_funnel_v1 from anon, authenticated/i);
  assert.match(migration,/grant select on public\.hercules_organic_acquisition_funnel_v1 to service_role/i);
});

test("organic system keeps paid acquisition off and does not depend on internal Vault material",()=>{
  assert.doesNotMatch(JSON.stringify(config),/vault/i);
  assert.equal(config.paidAcquisition.enabled,false);
  assert.equal(config.tracking.destination,"protected_marketing_events");
});
