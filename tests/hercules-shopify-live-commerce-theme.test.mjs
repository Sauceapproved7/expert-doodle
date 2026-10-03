import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const base = new URL("../shopify/hercules/extensions/hercules-live-commerce/", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, base), "utf8");
}

test("live commerce extension is a theme app extension with no additional API scopes", async () => {
  const extension = await read("shopify.extension.toml");
  const appConfig = await read("../shopify.app.toml");

  assert.match(extension, /^type\s*=\s*"theme"$/m);
  assert.match(extension, /^handle\s*=\s*"hercules-live-commerce"$/m);
  assert.match(appConfig, /scopes\s*=\s*"read_orders"/);
});

test("live event block schema exposes a selected Shopify product and explicit event states", async () => {
  const block = await read("blocks/live-event.liquid");
  const schemaText = block.match(/{% schema %}\s*([\s\S]*?)\s*{% endschema %}/)?.[1];

  assert.ok(schemaText, "Liquid block must contain a schema");
  const schema = JSON.parse(schemaText);
  assert.equal(schema.name, "Live event");
  assert.equal(schema.target, "section");
  assert.ok(schema.settings.some((setting) => setting.type === "product" && setting.id === "product"));

  const states = schema.settings.find((setting) => setting.id === "event_state");
  assert.deepEqual(states.options.map((option) => option.value), ["scheduled", "live", "ended"]);
  assert.equal(states.default, "scheduled");
});

test("stream links render only for live events over HTTPS and open safely", async () => {
  const block = await read("blocks/live-event.liquid");

  assert.match(block, /event_state == 'live' and stream_scheme == 'https' and stream_link contains ':\/\//);
  assert.match(block, /target="_blank" rel="noopener noreferrer"/);
  assert.match(block, /featured_product\.title \| escape/);
});

test("product purchase path stays on the Shopify product variant page", async () => {
  const block = await read("blocks/live-event.liquid");

  assert.match(block, /href="{{ live_variant\.url }}"/);
  assert.doesNotMatch(block, /admin\/api|access.token|write_inventory/i);
});
