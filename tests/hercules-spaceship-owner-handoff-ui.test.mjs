import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const ui=await readFile(new URL("../supabase/functions/hercules-integrations/index.ts",import.meta.url),"utf8");

test("Spaceship owner handoff links directly to API Manager",()=>{
  assert.match(ui,/https:\/\/www\.spaceship\.com\/application\/api-manager\//);
  assert.match(ui,/target="_blank"/);
  assert.match(ui,/rel="noopener noreferrer"/);
});

test("owner handoff states exact least-privilege DNS permissions",()=>{
  assert.match(ui,/dnsrecords:read/);
  assert.match(ui,/dnsrecords:write/);
});

test("credential submission continues the launch automatically",()=>{
  assert.match(ui,/Save DNS credentials \+ continue launch/);
  assert.match(ui,/configure_spaceship_dns/);
  assert.match(ui,/await reconcileDomain\(\)/);
  assert.match(ui,/\$\('shipkey'\)\.value=''/);
  assert.match(ui,/\$\('shipsecret'\)\.value=''/);
});
