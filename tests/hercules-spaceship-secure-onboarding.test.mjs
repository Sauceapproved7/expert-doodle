import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const bridge=await readFile(new URL("../supabase/functions/hercules-private-bridge/index.ts",import.meta.url),"utf8");
const integrations=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Spaceship credential setup stays behind Hercules owner/admin authentication",()=>{
  assert.match(bridge,/const a=await actor\(req\); if\(!a\)return out\(\{error:'owner_or_admin_required'\},403\)/);
  assert.match(bridge,/action==='configure_spaceship_dns'/);
  assert.match(bridge,/hercules_spaceship_dns_configure_credentials/);
  const actorIndex=bridge.indexOf("const a=await actor(req)");
  const configureIndex=bridge.indexOf("action==='configure_spaceship_dns'");
  assert.ok(actorIndex>=0&&configureIndex>actorIndex);
});

test("bridge never returns or audits raw Spaceship credentials",()=>{
  const block=bridge.slice(
    bridge.indexOf("if(action==='configure_spaceship_dns')"),
    bridge.indexOf("if(action==='upsert_profile')")
  );
  assert.match(block,/secretExposure:false/);
  assert.doesNotMatch(block,/return out\([^\n]*(?:apiKey|apiSecret)/);
  assert.doesNotMatch(block,/changes:\{[^}]*api_/);
  assert.doesNotMatch(block,/metadata:\{[^}]*api_/);
  assert.match(block,/b\.api_key=''; b\.api_secret=''/);
});

test("status exposes configuration state only, not Vault references",()=>{
  const block=bridge.slice(
    bridge.indexOf("if(action==='spaceship_dns_status')"),
    bridge.indexOf("if(action==='configure_spaceship_dns')")
  );
  assert.match(block,/select\('status,configured_at,updated_at'\)/);
  assert.doesNotMatch(block,/secret_ref/);
});

test("Integrations UI uses password input and clears credentials after submit",()=>{
  assert.match(integrations,/id="shipsecret"[^>]*type="password"/);
  assert.match(integrations,/autocomplete="new-password"/);
  assert.match(integrations,/action:'configure_spaceship_dns'/);
  assert.match(integrations,/\$\('shipkey'\)\.value=''/);
  assert.match(integrations,/\$\('shipsecret'\)\.value=''/);
  assert.match(integrations,/dnsrecords:read/);
  assert.match(integrations,/dnsrecords:write/);
});


test("one-time Spaceship credential drop validates before Vault storage",()=>{
  assert.match(bridge,/SPACESHIP_CREDENTIAL_DROP_PURPOSE='spaceship-dns-credential-drop-v1'/);
  assert.match(bridge,/validateSpaceshipExternalPair/);
  assert.match(bridge,/https:\/\/spaceship\.dev\/api\/v1\/dns\/records\/sauceapproved\.com/);
  assert.match(bridge,/'X-API-Key'/);
  assert.match(bridge,/'X-API-Secret'/);
  const validateIndex=bridge.indexOf("validateSpaceshipExternalPair(apiKey,apiSecret)");
  const storeIndex=bridge.indexOf("hercules_spaceship_dns_configure_credentials");
  assert.ok(validateIndex>=0&&storeIndex>validateIndex);
  assert.match(bridge,/status:'starting'/);
  assert.match(bridge,/status:'completed'/);
  assert.match(bridge,/hercules_domain_launch_autopilot_tick/);
  assert.match(bridge,/hercules_business_email_dns_autopilot_tick/);
  assert.match(bridge,/Spaceship rejected this API key and secret/);
  assert.match(bridge,/dnsrecords:read and\/or dnsrecords:write/);
});
