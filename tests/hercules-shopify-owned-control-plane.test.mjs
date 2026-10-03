import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("owned Shopify control plane pins the existing Hercules app and Flow action",async()=>{
  const app=await read("shopify/hercules/shopify.app.toml");
  const ext=await read("shopify/hercules/extensions/hercules-paid-order/shopify.extension.toml");
  assert.match(app,/client_id\s*=\s*"1ed12710f0b797a7a3328c1cf4e8b1f9"/);
  assert.match(ext,/type\s*=\s*"flow_action"/);
  assert.match(ext,/hercules-shopify-webhook/);
});

test("owned Shopify control plane never carries commerce unlocks or secrets",async()=>{
  const files=await Promise.all([
    read("shopify/hercules/shopify.app.toml"),
    read("shopify/hercules/extensions/hercules-paid-order/shopify.extension.toml")
  ]);
  const joined=files.join("\n");
  assert.doesNotMatch(joined,/COMMERCE_ENABLED\s*=\s*true/);
  assert.doesNotMatch(joined,/client_secret|access_token|bridge_token|signing_secret/i);
});
