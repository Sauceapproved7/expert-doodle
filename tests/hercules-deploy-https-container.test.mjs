import test from "node:test";
import assert from "node:assert/strict";
import {HttpsContainerTargetAdapter} from "../hercules-deploy/https-container.mjs";

function request(overrides = {}) {
  return {
    serviceId: "hercules-ai",
    releaseId: "hercules-ai-mcp-v1",
    sourceCommit: "a".repeat(40),
    artifactFingerprint: "b".repeat(64),
    publicOrigin: "https://hercules.example.test",
    target: {kind: "https_container", reference: "hercules-ai"},
    metadata: {},
    ...overrides,
  };
}

test("HTTPS container target rejects non-HTTPS public origins before deploy", async () => {
  let called = false;
  const adapter = new HttpsContainerTargetAdapter({
    deployRelease: async () => { called = true; },
    fetchImpl: async () => new Response("ok"),
  });
  await assert.rejects(
    adapter.deploy({deploymentId: "deploy-1", request: request({publicOrigin: "http://hercules.example.test"})}),
    /publicOrigin must use HTTPS/,
  );
  assert.equal(called, false);
});

test("HTTPS container target deploy evidence stays credential-free", async () => {
  const adapter = new HttpsContainerTargetAdapter({
    deployRelease: async ({serviceId, sourceCommit, artifactFingerprint}) => ({
      serviceId,
      sourceCommit,
      artifactFingerprint,
      providerDeploymentId: "provider-123",
    }),
    fetchImpl: async () => new Response("ok"),
  });
  const evidence = await adapter.deploy({deploymentId: "deploy-2", request: request()});
  assert.equal(evidence.providerDeploymentId, "provider-123");
  assert.doesNotMatch(JSON.stringify(evidence), /authorization|token|secret|password|api.?key/i);
});

test("HTTPS container target verifies health and MCP endpoint", async () => {
  const seen = [];
  const adapter = new HttpsContainerTargetAdapter({
    deployRelease: async () => ({providerDeploymentId: "provider-123"}),
    fetchImpl: async (url, init = {}) => {
      seen.push({url: String(url), method: init.method ?? "GET"});
      if (String(url).endsWith("/health")) {
        return new Response(JSON.stringify({ok: true, service: "hercules-ai", mcp: "/mcp"}), {
          status: 200,
          headers: {"content-type": "application/json"},
        });
      }
      if (String(url).endsWith("/mcp")) {
        return new Response(JSON.stringify({detail: "Unauthorized"}), {status: 401});
      }
      return new Response("not found", {status: 404});
    },
  });
  const result = await adapter.verify({deploymentId: "deploy-3", request: request()});
  assert.equal(result.verified, true);
  assert.equal(result.mcpProtected, true);
  assert.deepEqual(seen.map((entry) => entry.url), [
    "https://hercules.example.test/health",
    "https://hercules.example.test/mcp",
  ]);
});

test("HTTPS container target verification fails closed on unhealthy or exposed MCP", async () => {
  const unhealthy = new HttpsContainerTargetAdapter({
    deployRelease: async () => ({}),
    fetchImpl: async () => new Response(JSON.stringify({ok: false}), {
      status: 200,
      headers: {"content-type": "application/json"},
    }),
  });
  await assert.rejects(unhealthy.verify({request: request()}), /health verification failed/);

  const exposed = new HttpsContainerTargetAdapter({
    deployRelease: async () => ({}),
    fetchImpl: async (url) => String(url).endsWith("/health")
      ? new Response(JSON.stringify({ok: true, service: "hercules-ai", mcp: "/mcp"}), {
          status: 200,
          headers: {"content-type": "application/json"},
        })
      : new Response("ok", {status: 200}),
  });
  await assert.rejects(exposed.verify({request: request()}), /MCP endpoint is not protected/);
});

test("HTTPS container target rollback delegates by provider deployment id", async () => {
  let rolledBack = null;
  const adapter = new HttpsContainerTargetAdapter({
    deployRelease: async () => ({providerDeploymentId: "provider-123"}),
    rollbackRelease: async (input) => { rolledBack = input; return {rolledBack: true}; },
    fetchImpl: async () => new Response("ok"),
  });
  const result = await adapter.rollback({
    deploymentId: "deploy-4",
    request: request(),
    state: {deployEvidence: {providerDeploymentId: "provider-123"}},
  });
  assert.equal(result.rolledBack, true);
  assert.equal(rolledBack.providerDeploymentId, "provider-123");
});
