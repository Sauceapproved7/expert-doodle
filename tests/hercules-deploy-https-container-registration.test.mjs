import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesDeployAdaptersFromEnv} from "../hercules-deploy/service.mjs";

test("Hercules Deploy registers a bounded HTTPS container target only when provider hooks are injected", () => {
  const withoutProvider = createHerculesDeployAdaptersFromEnv({});
  assert.equal(withoutProvider.has("https_container"), false);

  const adapters = createHerculesDeployAdaptersFromEnv({}, {
    fetchImpl: async () => new Response("ok"),
    httpsContainerProvider: {
      deployRelease: async () => ({providerDeploymentId: "provider-123"}),
      rollbackRelease: async () => ({rolledBack: true}),
    },
  });

  assert.equal(adapters.has("https_container"), true);
  const adapter = adapters.get("https_container");
  assert.equal(typeof adapter.deploy, "function");
  assert.equal(typeof adapter.verify, "function");
  assert.equal(typeof adapter.rollback, "function");
});
