import test from "node:test";
import assert from "node:assert/strict";
import {RenderDeployProviderClient} from "../hercules-deploy/render-provider.mjs";

const serviceId = "srv-db0sic6gekts73b40jcg";
const token = "rnd_test_token_for_hercules_deployer_123456";

test("Render provider deploys an exact commit without leaking credentials", async () => {
  const calls = [];
  const client = new RenderDeployProviderClient({
    apiToken: token,
    allowedServiceIds: [serviceId],
    fetchImpl: async (url, options = {}) => {
      calls.push({url: String(url), options});
      assert.equal(options.headers.authorization, "Bearer " + token);
      assert.equal(String(url).includes(token), false);
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {clearCache: "do_not_clear", commitId: "a".repeat(40)});
      return Response.json({id: "dep-123", status: "build_in_progress", commit: {id: "a".repeat(40)}}, {status: 201});
    },
  });
  const result = await client.deployRelease({serviceId, sourceCommit: "a".repeat(40)});
  assert.deepEqual(result, {provider: "render", providerDeploymentId: "dep-123", serviceId, sourceCommit: "a".repeat(40)});
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(calls.length, 1);
});

test("Render provider fails closed outside its service allowlist and on insecure API origins", async () => {
  assert.throws(() => new RenderDeployProviderClient({apiToken: token, allowedServiceIds: [serviceId], baseUrl: "http://api.render.com"}), /credential-free HTTPS URL/);
  const client = new RenderDeployProviderClient({apiToken: token, allowedServiceIds: [serviceId], fetchImpl: async () => { throw new Error("network should not be called"); }});
  await assert.rejects(client.deployRelease({serviceId: "srv-not-allowed", sourceCommit: "a".repeat(40)}), /service is not allowed/);
});

test("Render provider rollback follows the official service rollback contract", async () => {
  const calls = [];
  const client = new RenderDeployProviderClient({
    apiToken: token,
    allowedServiceIds: [serviceId],
    fetchImpl: async (url, options = {}) => {
      calls.push({url: String(url), options});
      return Response.json({id: "dep-rollback-created", status: "created", trigger: "rollback"}, {status: 201});
    },
  });
  const result = await client.rollbackRelease({serviceId, providerDeploymentId: "dep-prior"});
  assert.deepEqual(result, {provider: "render", providerDeploymentId: "dep-rollback-created", rollbackTargetDeploymentId: "dep-prior", serviceId, rolledBack: true});
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v1\/services\/srv-db0sic6gekts73b40jcg\/rollback$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {deployId: "dep-prior"});
});

test("Render provider rejects malformed commit and deployment identifiers before network access", async () => {
  const client = new RenderDeployProviderClient({apiToken: token, allowedServiceIds: [serviceId], fetchImpl: async () => { throw new Error("network should not be called"); }});
  await assert.rejects(client.deployRelease({serviceId, sourceCommit: "main"}), /commit SHA is invalid/);
  await assert.rejects(client.rollbackRelease({serviceId, providerDeploymentId: "../latest"}), /deployment id is invalid/);
});
