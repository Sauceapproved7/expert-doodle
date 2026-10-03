import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(p)=>readFile(new URL(`../${p}`,import.meta.url),"utf8");

test("Shopify app deployment is automated from main and uses app-scoped CI auth",async()=>{
  const workflow=await read(".github/workflows/hercules-shopify-app-deploy.yml");
  assert.match(workflow,/push:\s*[\s\S]*branches:\s*\[?main\]?/);
  assert.match(workflow,/SHOPIFY_APP_AUTOMATION_TOKEN/);
  assert.match(workflow,/shopify app deploy/);
  assert.match(workflow,/--config production/);
  assert.match(workflow,/--allow-updates/);
  assert.doesNotMatch(workflow,/--allow-deletes|--force/);
});

test("production deploy config exists and stays bound to the existing Hercules app",async()=>{
  const production=await read("shopify/hercules/shopify.app.production.toml");
  assert.match(production,/client_id\s*=\s*"1ed12710f0b797a7a3328c1cf4e8b1f9"/);
  assert.match(production,/name\s*=\s*"Hercules"/);
  assert.match(production,/scopes\s*=\s*"read_orders"/);
  assert.doesNotMatch(production,/client_secret|access_token|bridge_token|signing_secret|COMMERCE_ENABLED/i);
});

test("Shopify autodeploy stays scoped to the existing Hercules app and never unlocks commerce",async()=>{
  const workflow=await read(".github/workflows/hercules-shopify-app-deploy.yml");
  const app=await read("shopify/hercules/shopify.app.toml");
  assert.match(app,/client_id\s*=\s*"1ed12710f0b797a7a3328c1cf4e8b1f9"/);
  assert.match(workflow,/shopify\/hercules/);
  assert.doesNotMatch(workflow,/COMMERCE_ENABLED\s*[:=]\s*true/i);
  assert.doesNotMatch(workflow,/client_secret|access_token|bridge_token|signing_secret/i);
});
