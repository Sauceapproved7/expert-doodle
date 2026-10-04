import test from "node:test";
import assert from "node:assert/strict";
import {createHerculesDeployAdaptersFromEnv} from "../hercules-deploy/service.mjs";

const serviceId = "srv-db0sic6gekts73b40jcg";
const token = "rnd_test_token_for_hercules_deployer_123456";

test("Hercules Deploy wires Render into https_container only with explicit token and allowlist", () => {
  const disabled = createHerculesDeployAdaptersFromEnv({});
  assert.equal(disabled.has("https_container"), false);

  const adapters = createHerculesDeployAdaptersFromEnv({
    HERCULES_RENDER_API_TOKEN: token,
    HERCULES_RENDER_SERVICE_IDS: serviceId,
  }, {fetchImpl: async () => { throw new Error("network is not used during wiring"); }});

  assert.equal(adapters.has("https_container"), true);
  const adapter = adapters.get("https_container");
  assert.equal(typeof adapter.deploy, "function");
  assert.equal(typeof adapter.verify, "function");
  assert.equal(typeof adapter.rollback, "function");
});

test("Hercules Deploy fails closed on partial Render environment configuration", () => {
  assert.throws(
    () => createHerculesDeployAdaptersFromEnv({HERCULES_RENDER_API_TOKEN: token}),
    /HERCULES_RENDER_SERVICE_IDS/,
  );
  assert.throws(
    () => createHerculesDeployAdaptersFromEnv({HERCULES_RENDER_SERVICE_IDS: serviceId}),
    /HERCULES_RENDER_API_TOKEN/,
  );
});
