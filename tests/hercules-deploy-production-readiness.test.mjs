import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHerculesDeployService} from "../hercules-deploy/control-api.mjs";

function adapter() {
  return Object.freeze({
    async deploy() { return {providerDeploymentId: "dep-test123"}; },
    async verify() { return {verified: true}; },
    async rollback() { return {rolledBack: true}; },
  });
}

async function withService(adapters, fn) {
  const root = await mkdtemp(join(tmpdir(), "hercules-deploy-ready-"));
  const recoveryRoot = await mkdtemp(join(tmpdir(), "hercules-deploy-ready-recovery-"));
  const service = createHerculesDeployService({
    root,
    recoveryRoot,
    token: "t".repeat(32),
    adapters,
    pollIntervalMs: 100,
    autoStartWorker: true,
  });
  await new Promise((resolve) => service.server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + service.server.address().port;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => service.server.close(resolve));
    await rm(root, {recursive: true, force: true});
    await rm(recoveryRoot, {recursive: true, force: true});
  }
}

test("Deploy Plane readiness fails closed when no production HTTPS target adapter is configured", async () => {
  await withService(new Map(), async (base) => {
    const response = await fetch(base + "/ready");
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ready, false);
    assert.equal(body.workerRunning, true);
    assert.equal(body.productionTargetReady, false);
    assert.deepEqual(body.adapterKinds, []);
  });
});

test("Deploy Plane readiness is secret-free and production-ready when HTTPS target adapter is configured", async () => {
  await withService(new Map([["https_container", adapter()]]), async (base) => {
    const response = await fetch(base + "/ready");
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ready, true);
    assert.equal(body.workerRunning, true);
    assert.equal(body.productionTargetReady, true);
    assert.deepEqual(body.adapterKinds, ["https_container"]);
    assert.equal(JSON.stringify(body).includes("token"), false);
    assert.equal(JSON.stringify(body).includes("secret"), false);
  });
});
