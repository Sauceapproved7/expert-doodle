import test from "node:test";
import assert from "node:assert/strict";
import {
  SupabaseEdgeFunctionTargetAdapter,
  fingerprintEdgeFunctionBundle,
} from "../hercules-deploy/supabase-edge.mjs";

const bundle = {
  slug: "hercules-revenue-rescue",
  entrypointPath: "index.ts",
  verifyJwt: true,
  files: [
    {name: "index.ts", content: 'Deno.serve(() => new Response("ok"));'},
    {name: "core.ts", content: "export const version = 1;"},
  ],
};

function request(overrides = {}) {
  return {
    serviceId: "hercules-revenue-rescue",
    releaseId: "revenue-rescue-v1",
    sourceCommit: "a".repeat(40),
    artifactFingerprint: fingerprintEdgeFunctionBundle(bundle),
    publicOrigin: "https://xbwuablxhhwsaoomsoco.supabase.co",
    target: {kind: "supabase_edge_function", reference: "xbwuablxhhwsaoomsoco:hercules-revenue-rescue"},
    metadata: {edgeFunction: structuredClone(bundle)},
    ...overrides,
  };
}

test("fingerprint is deterministic and content-sensitive", () => {
  const a = fingerprintEdgeFunctionBundle(bundle);
  const b = fingerprintEdgeFunctionBundle(structuredClone(bundle));
  const changed = structuredClone(bundle);
  changed.files[0].content += "\n// change";
  assert.equal(a, b);
  assert.notEqual(a, fingerprintEdgeFunctionBundle(changed));
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("adapter refuses an artifact whose fingerprint does not match", async () => {
  let deployed = false;
  const adapter = new SupabaseEdgeFunctionTargetAdapter({
    deployFunction: async () => { deployed = true; },
    getFunction: async () => null,
    deleteFunction: async () => {},
  });
  await assert.rejects(
    adapter.deploy({deploymentId: "deploy-1", request: request({artifactFingerprint: "b".repeat(64)})}),
    /artifact fingerprint mismatch/,
  );
  assert.equal(deployed, false);
});

test("adapter deploys, verifies, and restores the previous function on rollback", async () => {
  let current = {
    slug: "hercules-revenue-rescue",
    status: "ACTIVE",
    version: 7,
    verify_jwt: false,
    files: [{name: "index.ts", content: "old source"}],
    entrypoint_path: "index.ts",
  };
  const adapter = new SupabaseEdgeFunctionTargetAdapter({
    getFunction: async () => current ? structuredClone(current) : null,
    deployFunction: async (payload) => {
      current = {
        slug: payload.slug,
        status: "ACTIVE",
        version: (current?.version ?? 0) + 1,
        verify_jwt: payload.verifyJwt,
        files: structuredClone(payload.files),
        entrypoint_path: payload.entrypointPath,
      };
      return structuredClone(current);
    },
    deleteFunction: async () => { current = null; },
  });

  const deployment = {deploymentId: "deploy-2", request: request()};
  const deployEvidence = await adapter.deploy(deployment);
  assert.equal(deployEvidence.provider, "supabase");
  assert.equal(deployEvidence.previousVersion, 7);
  assert.equal(current.verify_jwt, true);

  const verification = await adapter.verify(deployment);
  assert.equal(verification.verified, true);
  assert.equal(verification.slug, "hercules-revenue-rescue");
  assert.ok(verification.version > 7);

  deployment.state = {deployEvidence};
  const rollback = await adapter.rollback(deployment);
  assert.equal(rollback.rolledBack, true);
  assert.equal(rollback.mode, "restore_previous");
  assert.equal(current.verify_jwt, false);
  assert.deepEqual(current.files, [{name: "index.ts", content: "old source"}]);
});
