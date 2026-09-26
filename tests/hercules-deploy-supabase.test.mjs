import test from "node:test";
import assert from "node:assert/strict";
import {SupabaseEdgeFunctionAdapter} from "../hercules-deploy/supabase-edge-adapter.mjs";

function deploymentFixture(overrides = {}) {
  return {
    deploymentId: "deploy-revenue-rescue",
    request: {
      serviceId: "hercules-revenue-rescue",
      releaseId: "revenue-rescue-v1",
      sourceCommit: "a".repeat(40),
      artifactFingerprint: "b".repeat(64),
      publicOrigin: "https://xbwuablxhhwsaoomsoco.supabase.co",
      target: {
        kind: "supabase_edge_function",
        reference: "xbwuablxhhwsaoomsoco/hercules-revenue-rescue",
      },
      metadata: {},
      ...overrides,
    },
  };
}

test("Supabase adapter deploys an owned artifact with the Management API and verifies ACTIVE state", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({url: String(url), options});
    if (options.method === "POST") {
      return new Response(JSON.stringify({
        slug: "hercules-revenue-rescue",
        status: "ACTIVE",
        version: 7,
        verify_jwt: true,
        entrypoint_path: "index.ts",
        ezbr_sha256: "bundle-sha",
      }), {status: 201, headers: {"content-type": "application/json"}});
    }
    return new Response(JSON.stringify({
      slug: "hercules-revenue-rescue",
      status: "ACTIVE",
      version: 7,
      verify_jwt: true,
      entrypoint_path: "index.ts",
      ezbr_sha256: "bundle-sha",
    }), {status: 200, headers: {"content-type": "application/json"}});
  };

  const adapter = new SupabaseEdgeFunctionAdapter({
    accessToken: "test-management-token",
    fetchImpl,
    artifactLoader: async () => ({
      entrypointPath: "index.ts",
      verifyJwt: true,
      files: [
        {name: "index.ts", content: "Deno.serve(() => new Response('ok'));"},
        {name: "core.ts", content: "export const ok = true;"},
      ],
    }),
  });

  const deployed = await adapter.deploy(deploymentFixture());
  assert.equal(deployed.targetKind, "supabase_edge_function");
  assert.equal(deployed.projectRef, "xbwuablxhhwsaoomsoco");
  assert.equal(deployed.functionSlug, "hercules-revenue-rescue");
  assert.equal(deployed.status, "ACTIVE");

  const verified = await adapter.verify(deploymentFixture());
  assert.equal(verified.verified, true);
  assert.equal(verified.status, "ACTIVE");
  assert.equal(verified.version, 7);

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/v1\/projects\/xbwuablxhhwsaoomsoco\/functions\/deploy\?slug=hercules-revenue-rescue$/);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.authorization, "Bearer test-management-token");
  assert.equal(calls[0].options.body instanceof FormData, true);
  assert.equal(calls[0].url.includes("test-management-token"), false);
});

test("Supabase adapter rejects malformed targets and never exposes management credentials in evidence", async () => {
  const adapter = new SupabaseEdgeFunctionAdapter({
    accessToken: "secret-management-token",
    fetchImpl: async () => new Response(JSON.stringify({
      slug: "safe-fn",
      status: "ACTIVE",
      version: 1,
      verify_jwt: true,
      entrypoint_path: "index.ts",
    }), {status: 201, headers: {"content-type": "application/json"}}),
    artifactLoader: async () => ({
      entrypointPath: "index.ts",
      verifyJwt: true,
      files: [{name: "index.ts", content: "export {};"}],
    }),
  });

  await assert.rejects(
    adapter.deploy(deploymentFixture({
      target: {kind: "supabase_edge_function", reference: "bad target"},
    })),
    /project-ref\/function-slug/,
  );

  const evidence = await adapter.deploy(deploymentFixture({
    target: {kind: "supabase_edge_function", reference: "safeproject/safe-fn"},
  }));
  assert.equal(JSON.stringify(evidence).includes("secret-management-token"), false);
});

test("Supabase adapter rollback redeploys the previous owned artifact when supplied", async () => {
  const calls = [];
  const adapter = new SupabaseEdgeFunctionAdapter({
    accessToken: "test-management-token",
    fetchImpl: async (url, options = {}) => {
      calls.push({url: String(url), options});
      return new Response(JSON.stringify({
        slug: "hercules-revenue-rescue",
        status: "ACTIVE",
        version: 8,
        verify_jwt: true,
        entrypoint_path: "index.ts",
      }), {status: 201, headers: {"content-type": "application/json"}});
    },
    artifactLoader: async (_deployment, purpose) => ({
      entrypointPath: "index.ts",
      verifyJwt: true,
      files: [{
        name: "index.ts",
        content: purpose === "rollback" ? "export const version = 0;" : "export const version = 1;",
      }],
    }),
  });

  const rolledBack = await adapter.rollback(deploymentFixture());
  assert.equal(rolledBack.rolledBack, true);
  assert.equal(rolledBack.status, "ACTIVE");
  assert.equal(calls.length, 1);
});

test("filesystem artifact loader reads only the requested Hercules release directory", async () => {
  const {mkdtemp, mkdir, writeFile, rm} = await import("node:fs/promises");
  const {tmpdir} = await import("node:os");
  const {join} = await import("node:path");
  const {createFileSystemSupabaseArtifactLoader} = await import("../hercules-deploy/supabase-artifacts.mjs");
  const root = await mkdtemp(join(tmpdir(), "hercules-supabase-artifacts-"));
  try {
    const release = join(root, "hercules-revenue-rescue", "revenue-rescue-v1");
    await mkdir(release, {recursive: true});
    await writeFile(join(release, "manifest.json"), JSON.stringify({
      entrypointPath: "index.ts",
      verifyJwt: true,
      files: ["index.ts", "core.ts"],
      rollbackReleaseId: "revenue-rescue-v0",
    }));
    await writeFile(join(release, "index.ts"), "export const version = 1;");
    await writeFile(join(release, "core.ts"), "export const core = true;");

    const previous = join(root, "hercules-revenue-rescue", "revenue-rescue-v0");
    await mkdir(previous, {recursive: true});
    await writeFile(join(previous, "manifest.json"), JSON.stringify({
      entrypointPath: "index.ts",
      verifyJwt: true,
      files: ["index.ts"],
    }));
    await writeFile(join(previous, "index.ts"), "export const version = 0;");

    const load = createFileSystemSupabaseArtifactLoader({root});
    const deployment = deploymentFixture();
    const current = await load(deployment, "deploy");
    const rollback = await load(deployment, "rollback");
    assert.equal(current.files[0].content, "export const version = 1;");
    assert.equal(rollback.files[0].content, "export const version = 0;");

    await assert.rejects(
      load(deploymentFixture({serviceId: "../escape"}), "deploy"),
      /path-safe identifier/,
    );
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
