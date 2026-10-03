import test from "node:test";
import assert from "node:assert/strict";
import {createMarketing16TargetAdapter, createHerculesDeployAdaptersFromEnv} from "../hercules-deploy/service.mjs";

function deploymentFixture() {
  return {
    deploymentId: "marketing-16-native-001",
    request: {
      serviceId: "hercules-marketing-16",
      releaseId: "marketing-16-v1",
      sourceCommit: "a".repeat(40),
      artifactFingerprint: "b".repeat(64),
      publicOrigin: "https://marketing.sauceapproved.test",
      target: {kind: "hercules_marketing_16", reference: "native-runtime"},
      metadata: {environment: "production"},
    },
  };
}

test("native Marketing-16 target deploys and verifies the fail-closed runtime", async () => {
  const adapter = createMarketing16TargetAdapter();
  const deployment = deploymentFixture();
  const deployed = await adapter.deploy(deployment);
  assert.equal(deployed.targetKind, "hercules_marketing_16");
  assert.equal(deployed.modules, 16);
  assert.equal(deployed.releaseReady, false);
  assert.equal(deployed.autoPublish, false);
  assert.equal(deployed.autoSpend, false);
  assert.equal(deployed.storefrontMutation, false);

  const verified = await adapter.verify(deployment);
  assert.equal(verified.verified, true);
  assert.equal(verified.modules, 16);
  assert.equal(verified.sourceCommit, deployment.request.sourceCommit);
  assert.equal(verified.artifactFingerprint, deployment.request.artifactFingerprint);
});

test("native Marketing-16 target rolls back only the active matching deployment", async () => {
  const adapter = createMarketing16TargetAdapter();
  const deployment = deploymentFixture();
  await adapter.deploy(deployment);
  const rolledBack = await adapter.rollback(deployment);
  assert.equal(rolledBack.rolledBack, true);
  await assert.rejects(adapter.verify(deployment), /deployment_not_active/);
});

test("Hercules Deploy registers the native Marketing-16 adapter without external provider credentials", () => {
  const adapters = createHerculesDeployAdaptersFromEnv({});
  assert.equal(adapters.has("hercules_marketing_16"), true);
});
