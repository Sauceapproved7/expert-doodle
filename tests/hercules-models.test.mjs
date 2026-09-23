import test from "node:test";
import assert from "node:assert/strict";
import {HERCULES_MODEL_SLOTS} from "../hercules-models/catalog.mjs";
import {validateModelManifest} from "../hercules-models/schema.mjs";
import {HerculesModelRegistry} from "../hercules-models/registry.mjs";
import {HerculesModelRouter} from "../hercules-models/router.mjs";
import {createModelPlaneService} from "../hercules-models/service.mjs";

const token = "m".repeat(24);

function activeModel(overrides = {}) {
  return {
    version: "0.1",
    id: "hercules-test",
    family: "hercules-test",
    description: "Test model.",
    tasks: ["general"],
    state: "active",
    origin: "hercules-native",
    priority: 100,
    runtime: {kind: "http", endpoint: "http://127.0.0.1:39000/generate"},
    checkpoint: "sha256:test",
    provenance: "test fixture",
    ...overrides,
  };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return "http://127.0.0.1:" + server.address().port;
}

test("canonical catalog defines six planned families and two evidence-backed active native models", () => {
  assert.equal(HERCULES_MODEL_SLOTS.length, 8);
  const registry = new HerculesModelRegistry(HERCULES_MODEL_SLOTS);
  assert.equal(registry.list().length, 8);
  for (const model of registry.list()) {
    assert.equal(model.origin, "hercules-native");
  }
  const active = registry.list({state: "active"});
  const planned = registry.list({state: "planned"});
  assert.equal(active.length, 2);
  assert.equal(planned.length, 6);
  assert.deepEqual(active.map((model) => model.id).sort(), [
    "hercules-agent",
    "hercules-retrieval",
  ]);
  for (const model of active) {
    assert.equal(model.runtime.kind, "embedded");
    assert.match(model.checkpoint, /^sha256:[a-f0-9]{64}$/);
  }
});

test("active models require an actual runtime", () => {
  const result = validateModelManifest(activeModel({runtime: null}));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /active models require a runtime/);
});

test("native-only production routing rejects external models", () => {
  const external = activeModel({
    id: "external-test",
    family: "external-test",
    origin: "external",
  });
  const registry = new HerculesModelRegistry([external]);
  const router = new HerculesModelRouter(registry);
  assert.throws(() => router.route({task: "general"}), /no eligible Hercules model/);
});

test("router prefers Hercules-native models even when migration mode permits alternatives", () => {
  const native = activeModel({id: "hercules-native-a", family: "hercules-native-a", priority: 10});
  const external = activeModel({
    id: "external-a",
    family: "external-a",
    origin: "external",
    priority: 1000,
  });
  const registry = new HerculesModelRegistry([external, native]);
  const router = new HerculesModelRouter(registry, {nativeOnly: false});
  assert.equal(router.route({task: "general"}).id, "hercules-native-a");
});

test("model plane service exposes health and authenticated routing", async () => {
  const server = createModelPlaneService({
    models: [activeModel()],
    token,
  });
  const base = await listen(server);
  try {
    const health = await fetch(base + "/health");
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.active, 1);
    assert.equal(healthBody.nativeOnly, true);

    const unauthorized = await fetch(base + "/v1/models");
    assert.equal(unauthorized.status, 401);

    const routed = await fetch(base + "/v1/route", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({task: "general"}),
    });
    assert.equal(routed.status, 200);
    const routedBody = await routed.json();
    assert.equal(routedBody.model.id, "hercules-test");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("untrained catalog families still fail closed instead of pretending a checkpoint exists", async () => {
  const server = createModelPlaneService({
    models: HERCULES_MODEL_SLOTS,
    token,
  });
  const base = await listen(server);
  try {
    const response = await fetch(base + "/v1/route", {
      method: "POST",
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify({task: "code"}),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /no eligible Hercules model/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
