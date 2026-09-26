import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {HttpHerculesDeployClient} from "../hercules-deploy/client.mjs";

function runtimeSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

test("Deploy Plane client requires HTTPS except loopback and keeps credentials in headers", async () => {
  assert.throws(
    () => new HttpHerculesDeployClient({
      endpoint: "http://deploy.example.test",
      token: runtimeSecret(),
    }),
    /must use https unless it is loopback/,
  );
  assert.throws(
    () => new HttpHerculesDeployClient({
      endpoint: "https://user:pass@deploy.example.test",
      token: runtimeSecret(),
    }),
    /must not include credentials/,
  );

  const token = runtimeSecret();
  const calls = [];
  const client = new HttpHerculesDeployClient({
    endpoint: "http://127.0.0.1:38800",
    token,
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {
        ok: true,
        status: 201,
        headers: {get: () => null},
        text: async () => JSON.stringify({
          deploymentId: "deploy-client",
          state: {status: "queued"},
        }),
      };
    },
  });

  const result = await client.enqueue({
    serviceId: "service-a",
    releaseId: "release-a",
    sourceCommit: "a".repeat(40),
    artifactFingerprint: "b".repeat(64),
    publicOrigin: "https://service-a.example.test",
    target: {kind: "memory", reference: "fixture"},
    metadata: {},
  }, {deploymentId: "deploy-client"});

  assert.equal(result.deploymentId, "deploy-client");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.authorization, "Bearer " + token);
  assert.equal(calls[0].url.includes(token), false);
});

test("Deploy Plane client rejects oversized responses before parsing", async () => {
  const client = new HttpHerculesDeployClient({
    endpoint: "https://deploy.example.test",
    token: runtimeSecret(),
    maxResponseBytes: 1024,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: {get: (name) => name === "content-length" ? "2048" : null},
      text: async () => "",
    }),
  });

  await assert.rejects(client.get("deploy-a"), /response too large/);
});
